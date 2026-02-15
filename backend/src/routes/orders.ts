import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/setup';
import { sendUSDC, getBalance } from '../services/wallet';
import { sendUSDCFromSmartAccount } from '../services/smart-account';
import { optionalApiKey } from '../middleware/auth';
import { decrypt, isEncrypted } from '../services/crypto';
import {
  isOnChainEscrowEnabled,
  createEscrowJobFromSmartAccount,
  createEscrowJobFromEOA,
  releaseEscrowJob,
  refundEscrowJob,
} from '../services/contracts';

export const orderRoutes = Router();

// ─── Helper: get escrow wallet (pass existing db to avoid SQLite conflicts) ───
function getEscrowPK(db: any) {
  const row = db.prepare("SELECT value FROM config WHERE key = 'escrow_private_key'").get() as any;
  if (!row?.value) return null;
  return isEncrypted(row.value) ? decrypt(row.value) : row.value;
}

// ─── Helper: decrypt agent private key ───
function decryptAgentPK(pk: string): string {
  return isEncrypted(pk) ? decrypt(pk) : pk;
}

function getEscrowAddr(db: any) {
  const row = db.prepare("SELECT value FROM config WHERE key = 'escrow_address'").get() as any;
  return row?.value || null;
}

// ─── Place an order (with escrow payment) ───
orderRoutes.post('/', optionalApiKey, async (req, res) => {
  try {
    const { gig_id, buyer_id: body_buyer_id, tier, brief, input_data, pay_now } = req.body;
    const buyer_id = (req as any).agent?.id || body_buyer_id;

    if (!gig_id || !buyer_id) {
      return res.status(400).json({ error: 'Required: gig_id, buyer_id' });
    }

    const db = getDb();

    const gig = db.prepare('SELECT * FROM gigs WHERE id = ? AND status = ?').get(gig_id, 'active') as any;
    if (!gig) { db.close(); return res.status(404).json({ error: 'Gig not found or inactive' }); }

    if (gig.agent_id === buyer_id) { db.close(); return res.status(400).json({ error: "You can't order your own gig" }); }

    const selectedTier = tier || 'basic';
    let price: number;
    if (selectedTier === 'premium' && gig.price_premium) price = gig.price_premium;
    else if (selectedTier === 'standard' && gig.price_standard) price = gig.price_standard;
    else price = gig.price_basic;

    const id = uuid();
    const deadline = new Date(Date.now() + (gig.delivery_time_hours || 1) * 60 * 60 * 1000).toISOString();

    // ─── Escrow: buyer funds the order ───
    let escrow_tx_hash = null;
    if (pay_now !== false) {
      const buyer = db.prepare('SELECT private_key, wallet_address, name, account_type FROM agents WHERE id = ?').get(buyer_id) as any;

      if (buyer?.private_key) {
        try {
          const balance = await getBalance(buyer.wallet_address);
          if (parseFloat(balance.usdc) < price) {
            db.close();
            return res.status(400).json({
              error: 'Insufficient USDC balance',
              required: price,
              available: parseFloat(balance.usdc),
              wallet: buyer.wallet_address,
              tip: 'Fund via https://faucet.circle.com/',
            });
          }
          const buyerKey = decryptAgentPK(buyer.private_key);

          if (isOnChainEscrowEnabled()) {
            // ─── On-chain escrow: approve + createJob on PaymentEscrow contract ───
            const seller = db.prepare('SELECT wallet_address FROM agents WHERE id = ?').get(gig.agent_id) as any;
            let result;
            if (buyer.account_type === 'smart_account') {
              result = await createEscrowJobFromSmartAccount(buyerKey, id, seller.wallet_address, price);
            } else {
              result = await createEscrowJobFromEOA(buyerKey, id, seller.wallet_address, price);
            }
            escrow_tx_hash = result.txHash;
            console.log(`🔒 On-chain escrow: ${buyer.name} locked $${price} USDC | tx: ${escrow_tx_hash}`);
          } else {
            // ─── Centralized escrow: buyer → platform wallet ───
            const escrowPK = getEscrowPK(db);
            const escrowAddr = getEscrowAddr(db);
            if (escrowPK && escrowAddr) {
              let result;
              if (buyer.account_type === 'smart_account') {
                result = await sendUSDCFromSmartAccount(buyerKey, escrowAddr, price);
              } else {
                result = await sendUSDC(buyerKey, escrowAddr, price);
              }
              escrow_tx_hash = result.txHash;
              console.log(`🔒 Escrow: ${buyer.name} locked $${price} USDC | tx: ${escrow_tx_hash}`);
            }
          }
        } catch (err: any) {
          db.close();
          return res.status(400).json({ error: 'Payment failed: ' + err.message, wallet: buyer.wallet_address });
        }
      }
    }

    db.prepare(`
      INSERT INTO orders (id, gig_id, buyer_id, seller_id, tier, price, brief, input_data, max_revisions, deadline, escrow_tx_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, gig_id, buyer_id, gig.agent_id, selectedTier, price,
      brief || null, input_data ? JSON.stringify(input_data) : null,
      gig.max_revisions || 1, deadline, escrow_tx_hash);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    db.close();

    console.log(`🛒 Order: ${id} | ${selectedTier} | $${price} USDC${escrow_tx_hash ? ' | ESCROWED' : ''}`);
    res.status(201).json(order);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get order details ───
orderRoutes.get('/:id', (req, res) => {
  const db = getDb();
  const order = db.prepare(`
    SELECT o.*, g.title as gig_title,
           buyer.name as buyer_name, seller.name as seller_name
    FROM orders o
    JOIN gigs g ON o.gig_id = g.id
    JOIN agents buyer ON o.buyer_id = buyer.id
    JOIN agents seller ON o.seller_id = seller.id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!order) { db.close(); return res.status(404).json({ error: 'Order not found' }); }

  const messages = db.prepare(`
    SELECT m.*, a.name as sender_name FROM messages m
    JOIN agents a ON m.sender_id = a.id
    WHERE m.order_id = ? ORDER BY m.created_at ASC
  `).all(req.params.id);

  db.close();
  res.json({ ...(order as any), messages });
});

// ─── List orders ───
orderRoutes.get('/', (req, res) => {
  const { agent_id, role, status, limit, offset } = req.query;
  const db = getDb();

  let query = `
    SELECT o.*, g.title as gig_title,
           buyer.name as buyer_name, seller.name as seller_name
    FROM orders o
    JOIN gigs g ON o.gig_id = g.id
    JOIN agents buyer ON o.buyer_id = buyer.id
    JOIN agents seller ON o.seller_id = seller.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (agent_id) {
    if (role === 'seller') { query += ' AND o.seller_id = ?'; }
    else if (role === 'buyer') { query += ' AND o.buyer_id = ?'; }
    else { query += ' AND (o.buyer_id = ? OR o.seller_id = ?)'; params.push(agent_id); }
    params.push(agent_id);
  }
  if (status) { query += ' AND o.status = ?'; params.push(status); }

  query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit) || 20, Number(offset) || 0);

  const orders = db.prepare(query).all(...params);
  db.close();
  res.json({ orders });
});

// ─── Update order status (with escrow release/refund) ───
orderRoutes.patch('/:id/status', async (req, res) => {
  const { status, agent_id } = req.body;
  const db = getDb();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as any;
  if (!order) { db.close(); return res.status(404).json({ error: 'Order not found' }); }

  const validTransitions: Record<string, { to: string[] }> = {
    'pending':     { to: ['accepted', 'rejected', 'cancelled'] },
    'accepted':    { to: ['in_progress', 'cancelled'] },
    'in_progress': { to: ['delivered', 'cancelled'] },
    'delivered':   { to: ['completed', 'revision_requested', 'disputed'] },
    'revision_requested': { to: ['in_progress'] },
    'disputed':    { to: ['resolved', 'completed', 'cancelled'] },
  };

  const current = order.status;
  const transition = validTransitions[current];
  if (!transition || !transition.to.includes(status)) {
    db.close();
    return res.status(400).json({ error: `Cannot go from "${current}" to "${status}"`, valid: transition?.to || [] });
  }

  const updates: string[] = ['status = ?', "updated_at = datetime('now')"];
  const updateParams: any[] = [status];

  if (status === 'accepted') updates.push("accepted_at = datetime('now')");
  if (status === 'delivered') updates.push("delivered_at = datetime('now')");
  if (status === 'completed') updates.push("completed_at = datetime('now')");
  if (status === 'cancelled') updates.push("cancelled_at = datetime('now')");

  // ─── ESCROW RELEASE → seller on completion ───
  if (status === 'completed' && order.escrow_tx_hash) {
    try {
      if (isOnChainEscrowEnabled()) {
        // On-chain: platform calls releaseJob on PaymentEscrow contract
        const result = await releaseEscrowJob(order.id);
        updates.push('release_tx_hash = ?');
        updateParams.push(result.txHash);
        const seller = db.prepare('SELECT name FROM agents WHERE id = ?').get(order.seller_id) as any;
        console.log(`💸 On-chain release: $${order.price} USDC → ${seller?.name} | tx: ${result.txHash}`);
      } else {
        // Centralized: escrow wallet sends USDC to seller
        const escrowPK = getEscrowPK(db);
        const seller = db.prepare('SELECT wallet_address, name FROM agents WHERE id = ?').get(order.seller_id) as any;
        if (escrowPK && seller?.wallet_address) {
          const result = await sendUSDC(escrowPK, seller.wallet_address, order.price);
          updates.push('release_tx_hash = ?');
          updateParams.push(result.txHash);
          console.log(`💸 Released: $${order.price} USDC → ${seller.name} | tx: ${result.txHash}`);
        }
      }
    } catch (err: any) { console.error(`❌ Release failed: ${err.message}`); }
  }

  // ─── ESCROW REFUND → buyer on cancellation ───
  if (status === 'cancelled' && order.escrow_tx_hash) {
    try {
      if (isOnChainEscrowEnabled()) {
        // On-chain: platform calls refundJob on PaymentEscrow contract
        const result = await refundEscrowJob(order.id);
        const buyer = db.prepare('SELECT name FROM agents WHERE id = ?').get(order.buyer_id) as any;
        console.log(`↩️ On-chain refund: $${order.price} USDC → ${buyer?.name} | tx: ${result.txHash}`);
      } else {
        // Centralized: escrow wallet refunds buyer
        const escrowPK = getEscrowPK(db);
        const buyer = db.prepare('SELECT wallet_address, name FROM agents WHERE id = ?').get(order.buyer_id) as any;
        if (escrowPK && buyer?.wallet_address) {
          const result = await sendUSDC(escrowPK, buyer.wallet_address, order.price);
          console.log(`↩️ Refunded: $${order.price} USDC → ${buyer.name} | tx: ${result.txHash}`);
        }
      }
    } catch (err: any) { console.error(`❌ Refund failed: ${err.message}`); }
  }

  updateParams.push(req.params.id);
  db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).run(...updateParams);

  // Update stats on completion
  if (status === 'completed') {
    db.prepare('UPDATE agents SET total_orders_completed = total_orders_completed + 1, total_earnings = total_earnings + ?, updated_at = datetime(\'now\') WHERE id = ?').run(order.price, order.seller_id);
    db.prepare('UPDATE gigs SET order_count = order_count + 1, updated_at = datetime(\'now\') WHERE id = ?').run(order.gig_id);
  }

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  db.close();
  console.log(`📋 Order ${req.params.id}: ${current} → ${status}`);
  res.json(updated);
});

// ─── Deliver an order ───
orderRoutes.post('/:id/deliver', (req, res) => {
  const { delivery_data, delivery_hash, agent_id } = req.body;
  const db = getDb();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as any;
  if (!order) { db.close(); return res.status(404).json({ error: 'Order not found' }); }
  if (order.seller_id !== agent_id) { db.close(); return res.status(403).json({ error: 'Only the seller can deliver' }); }
  if (!['accepted', 'in_progress', 'revision_requested'].includes(order.status)) {
    db.close(); return res.status(400).json({ error: `Cannot deliver from "${order.status}"` });
  }

  db.prepare(`
    UPDATE orders SET status = 'delivered', delivery_data = ?, delivery_hash = ?,
      delivered_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
  `).run(delivery_data ? JSON.stringify(delivery_data) : null, delivery_hash || null, req.params.id);

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  db.close();
  console.log(`📤 Order ${req.params.id} delivered`);
  res.json(updated);
});

// ─── Send a message ───
orderRoutes.post('/:id/messages', (req, res) => {
  const { sender_id, content, message_type } = req.body;
  const db = getDb();
  const id = uuid();
  db.prepare('INSERT INTO messages (id, order_id, sender_id, content, message_type) VALUES (?, ?, ?, ?, ?)').run(id, req.params.id, sender_id, content, message_type || 'text');
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  db.close();
  res.status(201).json(msg);
});
