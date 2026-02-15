import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/setup';
import { explorerUrl, sendUSDC, getBalance } from '../services/wallet';
import { generateApiKey, hashApiKey, requireApiKey } from '../middleware/auth';
import { encrypt, decrypt, isEncrypted } from '../services/crypto';
import {
  createSmartAccount,
  sendUSDCFromSmartAccount,
  isPimlicoConfigured,
  addOwnerToSafe,
  isSafeDeployed,
  isOwnerOfSafe,
  getSafeOwners,
  getSafeThreshold,
} from '../services/smart-account';
import { generatePrivateKey } from 'viem/accounts';
import { verifyMessage } from 'viem';
import { registerAgentOnChain, isRegistryConfigured } from '../services/contracts';
import erc8004Mapping from '../erc8004-mapping.json';

export const agentRoutes = Router();

// Helper: enrich agent(s) with ERC-8004 ID from mapping
function enrichWithErc8004(agent: any): any {
  if (!agent?.name) return agent;
  const erc8004Id = (erc8004Mapping as any).agents[agent.name] || null;
  return { ...agent, erc8004_id: erc8004Id };
}

function enrichAgentList(agents: any[]): any[] {
  return agents.map(enrichWithErc8004);
}

// Helper: compute is_online from last_seen
function enrichWithOnlineStatus(agent: any): any {
  if (!agent) return agent;
  const isOnline = agent.last_seen
    ? new Date(agent.last_seen + 'Z').getTime() > Date.now() - 2 * 60 * 1000
    : false;
  return { ...agent, is_online: isOnline };
}

function enrichAgentListWithOnline(agents: any[]): any[] {
  return agents.map(enrichWithOnlineStatus);
}

// ─── Register a new agent (PUBLIC — no auth needed) ───
// Returns: agent profile + API key + wallet address
// The API key is shown ONCE — we only store the hash
agentRoutes.post('/register', async (req, res) => {
  try {
    const { name, description, category, tags, avatar_url, owner_wallet } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!owner_wallet) return res.status(400).json({ error: 'owner_wallet is required' });

    // Validate owner_wallet format (0x + 40 hex chars)
    if (!/^0x[0-9a-fA-F]{40}$/.test(owner_wallet)) {
      return res.status(400).json({ error: 'Invalid owner_wallet format (expected 0x + 40 hex characters)' });
    }

    const db = getDb();
    const id = uuid();

    // Generate signer key + derive Safe Smart Account address
    const signerKey = generatePrivateKey();
    const { address: smartAccountAddress } = await createSmartAccount(signerKey);
    const encryptedKey = encrypt(signerKey);

    console.log(`[Register] Smart Account created for "${name}": ${smartAccountAddress}`);

    // Generate API key
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    db.prepare(`
      INSERT INTO agents (id, name, description, wallet_address, private_key, category, tags, avatar_url, api_key_hash, account_type, owner_wallet, safe_deployed, owner_added_on_chain)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description || '', smartAccountAddress, encryptedKey, category || 'general', JSON.stringify(tags || []), avatar_url || null, apiKeyHash, 'smart_account', owner_wallet, 0, 0);

    const agent = db.prepare('SELECT id, name, description, wallet_address, category, tags, avatar_url, status, rating_avg, rating_count, total_earnings, total_orders_completed, account_type, owner_wallet, safe_deployed, owner_added_on_chain, created_at FROM agents WHERE id = ?').get(id) as any;
    db.close();

    console.log(`[Register] New agent registered: "${name}" (${id})`);

    // Fire-and-forget: register agent on-chain via AgentRegistry
    if (isRegistryConfigured()) {
      registerAgentOnChain(id, smartAccountAddress, owner_wallet).catch((err: any) => {
        console.error(`[Contract] Failed to register agent on-chain: ${err.message}`);
      });
    }

    // Return API key ONCE — never shown again
    res.status(201).json({
      ...agent,
      api_key: apiKey,
      wallet_explorer: explorerUrl(smartAccountAddress, 'address'),
      _note: 'Save your api_key now -- it will not be shown again!',
    });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Wallet address already registered' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── Heartbeat — agent pings to stay "online" ───
agentRoutes.post('/:id/heartbeat', (req, res) => {
  try {
    const agentId = req.params.id;
    const db = getDb();

    const agent = db.prepare('SELECT id, name FROM agents WHERE id = ?').get(agentId) as any;
    if (!agent) {
      db.close();
      return res.status(404).json({ error: 'Agent not found' });
    }

    db.prepare("UPDATE agents SET last_seen = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(agentId);

    const updated = db.prepare('SELECT last_seen FROM agents WHERE id = ?').get(agentId) as any;
    db.close();

    res.json({
      success: true,
      agent_id: agentId,
      last_seen: updated.last_seen,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Rotate API key (requires current API key) ───
agentRoutes.post('/rotate-key', requireApiKey, (req, res) => {
  const agentId = (req as any).agent.id;
  const db = getDb();

  const newKey = generateApiKey();
  const newHash = hashApiKey(newKey);

  db.prepare("UPDATE agents SET api_key_hash = ?, updated_at = datetime('now') WHERE id = ?").run(newHash, agentId);
  db.close();

  console.log(`[Auth] API key rotated for agent ${agentId}`);
  res.json({
    api_key: newKey,
    _note: 'Save your new api_key now -- the old one is invalidated!',
  });
});

// ─── Withdraw USDC to external wallet ───
agentRoutes.post('/withdraw', requireApiKey, async (req, res) => {
  try {
    const agentId = (req as any).agent.id;
    const { to, amount } = req.body;

    if (!to || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Required: to (address), amount (number > 0)' });
    }

    const db = getDb();
    const agent = db.prepare('SELECT id, name, wallet_address, private_key, account_type, safe_deployed FROM agents WHERE id = ?').get(agentId) as any;

    if (!agent?.private_key) {
      db.close();
      return res.status(400).json({ error: 'No wallet private key -- agent registered with external wallet' });
    }

    // Decrypt private key
    const privateKey = isEncrypted(agent.private_key) ? decrypt(agent.private_key) : agent.private_key;

    // Check balance
    const balance = await getBalance(agent.wallet_address);
    if (Number(balance.usdc) < amount) {
      db.close();
      return res.status(400).json({
        error: `Insufficient balance: $${balance.usdc} USDC available, $${amount} requested`,
      });
    }

    // Send USDC — branch on account type
    let result;
    if (agent.account_type === 'smart_account') {
      result = await sendUSDCFromSmartAccount(privateKey, to, amount);

      // Mark Safe as deployed after first successful transaction
      if (!agent.safe_deployed) {
        db.prepare("UPDATE agents SET safe_deployed = 1, updated_at = datetime('now') WHERE id = ?").run(agentId);
        console.log(`[Safe] Marked Safe as deployed for agent ${agentId}`);
      }
    } else {
      result = await sendUSDC(privateKey, to, amount);
    }
    db.close();

    console.log(`[Withdraw] ${agent.name} -> ${to} | $${amount} USDC | tx: ${result.txHash}`);
    res.json({
      success: true,
      from: agent.wallet_address,
      to,
      amount,
      tx_hash: result.txHash,
      explorer: explorerUrl(result.txHash, 'tx'),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Add owner_wallet as co-owner of the Safe on-chain (requires API key) ───
agentRoutes.post('/:id/add-owner', requireApiKey, async (req, res) => {
  try {
    const agentId = (req as any).agent.id;

    // Can only add owner to own agent
    if (agentId !== req.params.id) {
      return res.status(403).json({ error: 'You can only add owner to your own agent' });
    }

    const db = getDb();
    const agent = db.prepare('SELECT id, name, wallet_address, private_key, account_type, owner_wallet, safe_deployed, owner_added_on_chain FROM agents WHERE id = ?').get(agentId) as any;

    if (!agent) {
      db.close();
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.account_type !== 'smart_account') {
      db.close();
      return res.status(400).json({ error: 'Agent does not use a Smart Account (Safe)' });
    }

    if (!agent.owner_wallet) {
      db.close();
      return res.status(400).json({ error: 'No owner_wallet set for this agent' });
    }

    if (agent.owner_added_on_chain) {
      db.close();
      return res.status(400).json({
        error: 'Owner wallet is already added as co-owner on-chain',
        owner_wallet: agent.owner_wallet,
        tx_hash: agent.owner_added_tx_hash,
      });
    }

    // Decrypt private key
    const privateKey = isEncrypted(agent.private_key) ? decrypt(agent.private_key) : agent.private_key;

    // Check if Safe is actually deployed (might not be if no tx was ever sent)
    const deployed = await isSafeDeployed(agent.wallet_address);
    if (!deployed) {
      db.close();
      return res.status(400).json({
        error: 'Safe is not deployed yet. Send a transaction first (e.g., withdraw or any UserOp) to deploy the Safe.',
        safe_address: agent.wallet_address,
      });
    }

    // Mark safe_deployed if not already tracked
    if (!agent.safe_deployed) {
      db.prepare("UPDATE agents SET safe_deployed = 1, updated_at = datetime('now') WHERE id = ?").run(agentId);
    }

    // Add owner on-chain
    const result = await addOwnerToSafe(privateKey, agent.owner_wallet);

    // Update DB
    db.prepare("UPDATE agents SET owner_added_on_chain = 1, owner_added_tx_hash = ?, updated_at = datetime('now') WHERE id = ?").run(result.txHash, agentId);
    db.close();

    console.log(`[Safe] Owner ${agent.owner_wallet} added to Safe ${agent.wallet_address} for agent ${agent.name}`);

    res.json({
      success: true,
      safe_address: result.safeAddress,
      owner_wallet: result.newOwner,
      tx_hash: result.txHash,
      explorer: explorerUrl(result.txHash, 'tx'),
      message: `Owner wallet ${agent.owner_wallet} is now a co-owner of the Safe. Threshold remains at 1 (either signer key or owner can sign independently).`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Owner withdrawal: owner_wallet signs to authorize a withdrawal ───
// No API key needed — owner authenticates via EIP-191 signature
agentRoutes.post('/:id/owner-withdraw', async (req, res) => {
  try {
    const agentId = req.params.id;
    const { to, amount, signature, message, timestamp } = req.body;

    // Validate required fields
    if (!to || !amount || !signature || !message || !timestamp) {
      return res.status(400).json({
        error: 'Required: to (address), amount (number > 0), signature (hex), message (string), timestamp (number)',
        expected_message_format: `Withdraw <amount> USDC from agent <agentId> to <toAddress> at <timestamp>`,
      });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'amount must be greater than 0' });
    }

    // Validate address format
    if (!/^0x[0-9a-fA-F]{40}$/.test(to)) {
      return res.status(400).json({ error: 'Invalid "to" address format' });
    }

    // Validate timestamp (must be within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const ts = Number(timestamp);
    if (Math.abs(now - ts) > 300) {
      return res.status(400).json({
        error: 'Timestamp is too old or too far in the future (must be within 5 minutes)',
        server_time: now,
        provided_time: ts,
      });
    }

    // Validate message format
    const expectedMessage = `Withdraw ${amount} USDC from agent ${agentId} to ${to} at ${timestamp}`;
    if (message !== expectedMessage) {
      return res.status(400).json({
        error: 'Message format mismatch',
        expected: expectedMessage,
        received: message,
      });
    }

    // Look up agent
    const db = getDb();
    const agent = db.prepare('SELECT id, name, wallet_address, private_key, account_type, owner_wallet, safe_deployed, owner_added_on_chain FROM agents WHERE id = ?').get(agentId) as any;

    if (!agent) {
      db.close();
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.account_type !== 'smart_account') {
      db.close();
      return res.status(400).json({ error: 'Agent does not use a Smart Account' });
    }

    if (!agent.owner_wallet) {
      db.close();
      return res.status(400).json({ error: 'No owner_wallet configured for this agent' });
    }

    // Verify the signature matches the owner_wallet
    let recoveredAddress: string;
    try {
      const valid = await verifyMessage({
        address: agent.owner_wallet as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });

      if (!valid) {
        db.close();
        return res.status(401).json({
          error: 'Signature verification failed -- signer does not match owner_wallet',
          owner_wallet: agent.owner_wallet,
        });
      }
      recoveredAddress = agent.owner_wallet;
    } catch (e: any) {
      db.close();
      return res.status(401).json({
        error: `Signature verification error: ${e.message}`,
      });
    }

    // Check balance
    const balance = await getBalance(agent.wallet_address);
    if (Number(balance.usdc) < amount) {
      db.close();
      return res.status(400).json({
        error: `Insufficient balance: $${balance.usdc} USDC available, $${amount} requested`,
      });
    }

    // Decrypt private key and execute withdrawal via agent's signer key
    const privateKey = isEncrypted(agent.private_key) ? decrypt(agent.private_key) : agent.private_key;
    const result = await sendUSDCFromSmartAccount(privateKey, to, amount);

    // Mark Safe as deployed if not already
    if (!agent.safe_deployed) {
      db.prepare("UPDATE agents SET safe_deployed = 1, updated_at = datetime('now') WHERE id = ?").run(agentId);
    }

    db.close();

    console.log(`[Owner Withdraw] ${agent.name} | owner ${recoveredAddress} -> ${to} | $${amount} USDC | tx: ${result.txHash}`);

    res.json({
      success: true,
      from: agent.wallet_address,
      to,
      amount,
      authorized_by: recoveredAddress,
      tx_hash: result.txHash,
      explorer: explorerUrl(result.txHash, 'tx'),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get Safe status (deployment, owners, threshold) ───
agentRoutes.get('/:id/safe-status', async (req, res) => {
  try {
    const db = getDb();
    const agent = db.prepare('SELECT id, name, wallet_address, account_type, owner_wallet, safe_deployed, owner_added_on_chain, owner_added_tx_hash FROM agents WHERE id = ?').get(req.params.id) as any;
    db.close();

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.account_type !== 'smart_account') {
      return res.status(400).json({ error: 'Agent does not use a Smart Account' });
    }

    // Check on-chain status
    const deployed = await isSafeDeployed(agent.wallet_address);
    let owners: string[] = [];
    let threshold = 0;

    if (deployed) {
      owners = await getSafeOwners(agent.wallet_address);
      threshold = await getSafeThreshold(agent.wallet_address);
    }

    const ownerIsOnChain = agent.owner_wallet
      ? owners.map((o: string) => o.toLowerCase()).includes(agent.owner_wallet.toLowerCase())
      : false;

    res.json({
      agent_id: agent.id,
      agent_name: agent.name,
      safe_address: agent.wallet_address,
      safe_deployed: deployed,
      safe_deployed_db: !!agent.safe_deployed,
      owners,
      threshold,
      owner_wallet: agent.owner_wallet || null,
      owner_added_on_chain_db: !!agent.owner_added_on_chain,
      owner_added_on_chain_actual: ownerIsOnChain,
      owner_added_tx_hash: agent.owner_added_tx_hash || null,
      explorer: explorerUrl(agent.wallet_address, 'address'),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get own profile (authenticated) ───
agentRoutes.get('/me', requireApiKey, (req, res) => {
  const agentId = (req as any).agent.id;
  const db = getDb();

  const agent = db.prepare(`
    SELECT id, name, description, wallet_address, category, tags, avatar_url,
           status, rating_avg, rating_count, total_earnings, total_orders_completed,
           response_time_avg, account_type, owner_wallet, safe_deployed,
           owner_added_on_chain, owner_added_tx_hash, last_seen, created_at, updated_at
    FROM agents WHERE id = ?
  `).get(agentId) as any;

  const gigs = db.prepare('SELECT * FROM gigs WHERE agent_id = ? AND status = ?').all(agentId, 'active');

  // Pending orders (as seller)
  const pendingOrders = db.prepare(`
    SELECT o.*, g.title as gig_title, buyer.name as buyer_name
    FROM orders o
    JOIN gigs g ON o.gig_id = g.id
    JOIN agents buyer ON o.buyer_id = buyer.id
    WHERE o.seller_id = ? AND o.status IN ('pending', 'accepted', 'in_progress')
    ORDER BY o.created_at DESC
  `).all(agentId);

  db.close();
  res.json(enrichWithOnlineStatus({ ...agent, gigs, pending_orders: pendingOrders }));
});

// ─── Get agent profile (PUBLIC — no auth) ───
agentRoutes.get('/:id', (req, res) => {
  const db = getDb();
  const agent = db.prepare(`
    SELECT id, name, description, wallet_address, category, tags, avatar_url,
           status, rating_avg, rating_count, total_earnings, total_orders_completed,
           response_time_avg, account_type, owner_wallet, safe_deployed,
           owner_added_on_chain, last_seen, created_at, updated_at
    FROM agents WHERE id = ?
  `).get(req.params.id) as any;

  if (!agent) {
    db.close();
    return res.status(404).json({ error: 'Agent not found' });
  }

  const gigs = db.prepare('SELECT * FROM gigs WHERE agent_id = ? AND status = ?').all(req.params.id, 'active');

  const reviews = db.prepare(`
    SELECT r.*, o.gig_id, g.title as gig_title
    FROM reviews r
    JOIN orders o ON r.order_id = o.id
    JOIN gigs g ON o.gig_id = g.id
    WHERE r.reviewed_id = ?
    ORDER BY r.created_at DESC
    LIMIT 10
  `).all(req.params.id);

  db.close();
  res.json(enrichWithErc8004(enrichWithOnlineStatus({ ...(agent as any), gigs, reviews })));
});

// ─── Search agents (PUBLIC) ───
agentRoutes.get('/', (req, res) => {
  const { category, search, status, sort, limit, offset, owner_wallet } = req.query;
  const db = getDb();

  let query = 'SELECT id, name, description, wallet_address, category, tags, avatar_url, status, rating_avg, rating_count, total_earnings, total_orders_completed, response_time_avg, account_type, owner_wallet, safe_deployed, owner_added_on_chain, last_seen, created_at, updated_at FROM agents WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as count FROM agents WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (owner_wallet) {
    query += ' AND owner_wallet = ?'; params.push(owner_wallet);
    countQuery += ' AND owner_wallet = ?'; countParams.push(owner_wallet);
  }
  if (category) {
    query += ' AND category = ?'; params.push(category);
    countQuery += ' AND category = ?'; countParams.push(category);
  }
  if (owner_wallet) {
    // When filtering by owner, show all statuses (not just active)
    if (status) { query += ' AND status = ?'; params.push(status); countQuery += ' AND status = ?'; countParams.push(status); }
  } else {
    if (status) { query += ' AND status = ?'; params.push(status); countQuery += ' AND status = ?'; countParams.push(status); }
    else { query += ' AND status = ?'; params.push('active'); countQuery += ' AND status = ?'; countParams.push('active'); }
  }
  if (search) {
    query += ' AND (name LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`);
    countQuery += ' AND (name LIKE ? OR description LIKE ?)'; countParams.push(`%${search}%`, `%${search}%`);
  }

  if (sort === 'rating') query += ' ORDER BY rating_avg DESC';
  else if (sort === 'orders') query += ' ORDER BY total_orders_completed DESC';
  else if (sort === 'earnings') query += ' ORDER BY total_earnings DESC';
  else query += ' ORDER BY created_at DESC';

  query += ` LIMIT ? OFFSET ?`;
  params.push(Number(limit) || 20, Number(offset) || 0);

  const agents = db.prepare(query).all(...params);
  const total = db.prepare(countQuery).get(...countParams) as any;
  db.close();

  res.json({ agents: enrichAgentListWithOnline(enrichAgentList(agents)), total: total.count });
});

// ─── Update agent profile (requires auth) ───
agentRoutes.patch('/:id', requireApiKey, (req, res) => {
  const agentId = (req as any).agent.id;

  // Can only update own profile
  if (agentId !== req.params.id) {
    return res.status(403).json({ error: 'You can only update your own profile' });
  }

  const { name, description, category, tags, avatar_url, status } = req.body;
  const db = getDb();

  const updates: string[] = [];
  const params: any[] = [];

  if (name) { updates.push('name = ?'); params.push(name); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (category) { updates.push('category = ?'); params.push(category); }
  if (tags) { updates.push('tags = ?'); params.push(JSON.stringify(tags)); }
  if (avatar_url !== undefined) { updates.push('avatar_url = ?'); params.push(avatar_url); }
  if (status && ['active', 'paused'].includes(status)) { updates.push('status = ?'); params.push(status); }

  if (updates.length === 0) {
    db.close();
    return res.status(400).json({ error: 'Nothing to update' });
  }

  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const agent = db.prepare('SELECT id, name, description, wallet_address, category, tags, avatar_url, status, rating_avg, rating_count, total_earnings, total_orders_completed, account_type, owner_wallet, safe_deployed, owner_added_on_chain, last_seen, created_at, updated_at FROM agents WHERE id = ?').get(req.params.id);
  db.close();

  res.json(enrichWithOnlineStatus(agent));
});
