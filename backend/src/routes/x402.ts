import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/setup';

const { x402ResourceServer, HTTPFacilitatorClient } = require('@x402/core/server');
const { ExactEvmScheme } = require('@x402/evm/exact/server');

export const x402Routes = Router();

const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';
const NETWORK = 'eip155:8453';

function getEscrowAddr(): string {
  const db = getDb();
  const row = db.prepare("SELECT value FROM config WHERE key = 'escrow_address'").get() as any;
  db.close();
  return row?.value || '';
}

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitatorClient);
resourceServer.register(NETWORK, new ExactEvmScheme());

x402Routes.post('/:gigId/purchase', async (req, res) => {
  try {
    const db = getDb();
    const gig = db.prepare('SELECT * FROM gigs WHERE id = ? AND status = ?').get(req.params.gigId, 'active') as any;
    if (!gig) { db.close(); return res.status(404).json({ error: 'Gig not found or inactive' }); }

    const tier = req.body?.tier || req.query.tier || 'basic';
    let price: number;
    if (tier === 'premium' && gig.price_premium) price = gig.price_premium;
    else if (tier === 'standard' && gig.price_standard) price = gig.price_standard;
    else price = gig.price_basic;

    const payTo = getEscrowAddr();
    if (!payTo) { db.close(); return res.status(500).json({ error: 'Escrow wallet not configured' }); }

    const paymentRequirements = [{
      scheme: 'exact',
      network: NETWORK,
      payTo,
      price: '$' + price,
      resource: 'https://gigent.xyz/api/gigs/' + gig.id + '/purchase',
      description: gig.title + ' (' + tier + ' tier)',
      maxTimeoutSeconds: 120,
      mimeType: 'application/json',
      outputSchema: { type: 'object', properties: { orderId: { type: 'string' }, status: { type: 'string' } } },
    }];

    const paymentHeader = req.headers['payment-signature'] || req.headers['x-payment'];

    if (!paymentHeader) {
      const paymentRequiredB64 = Buffer.from(JSON.stringify(paymentRequirements)).toString('base64');
      db.close();
      res.status(402);
      res.setHeader('PAYMENT-REQUIRED', paymentRequiredB64);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED');
      return res.json({ error: 'Payment Required', x402: { version: '2', accepts: paymentRequirements } });
    }

    let verification;
    try {
      verification = await resourceServer.verifyPayment(
        typeof paymentHeader === 'string' ? paymentHeader : paymentHeader[0],
        paymentRequirements
      );
    } catch (err: any) {
      db.close();
      return res.status(402).json({ error: 'Payment verification failed', detail: err.message, x402: { version: '2', accepts: paymentRequirements } });
    }

    if (!verification?.valid) {
      db.close();
      return res.status(402).json({ error: 'Payment invalid', detail: verification?.invalidReason || 'Unknown', x402: { version: '2', accepts: paymentRequirements } });
    }

    let settlement;
    try {
      settlement = await resourceServer.settlePayment(
        typeof paymentHeader === 'string' ? paymentHeader : paymentHeader[0],
        paymentRequirements
      );
    } catch (err: any) {
      db.close();
      return res.status(500).json({ error: 'Payment settlement failed', detail: err.message });
    }

    const buyerAddress = verification.payerAddress || 'x402-anonymous';
    let buyerAgent = db.prepare('SELECT id, name FROM agents WHERE wallet_address = ? COLLATE NOCASE').get(buyerAddress) as any;

    if (!buyerAgent) {
      const buyerId = uuid();
      db.prepare("INSERT INTO agents (id, name, wallet_address, status, description, category) VALUES (?, ?, ?, 'active', 'x402 autonomous buyer', 'buyer')").run(buyerId, 'x402-' + buyerAddress.slice(0, 8), buyerAddress);
      buyerAgent = { id: buyerId, name: 'x402-' + buyerAddress.slice(0, 8) };
    }

    const orderId = uuid();
    const deadline = new Date(Date.now() + (gig.delivery_time_hours || 1) * 60 * 60 * 1000).toISOString();

    db.prepare("INSERT INTO orders (id, gig_id, buyer_id, seller_id, tier, price, brief, max_revisions, deadline, escrow_tx_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')").run(
      orderId, gig.id, buyerAgent.id, gig.agent_id, tier, price,
      req.body?.brief || 'x402 purchase of ' + gig.title,
      gig.max_revisions || 1, deadline,
      settlement?.txHash || settlement?.transaction || 'x402-settled'
    );

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    db.close();

    console.log('x402 Order: ' + orderId + ' | ' + gig.title + ' | $' + price + ' USDC | buyer: ' + buyerAgent.name);

    if (settlement) {
      const settlementB64 = Buffer.from(JSON.stringify(settlement)).toString('base64');
      res.setHeader('PAYMENT-RESPONSE', settlementB64);
      res.setHeader('Access-Control-Expose-Headers', 'PAYMENT-RESPONSE');
    }

    res.status(200).json({ order, x402: { settled: true, txHash: settlement?.txHash || settlement?.transaction, network: NETWORK } });
  } catch (err: any) {
    console.error('x402 error:', err);
    res.status(500).json({ error: err.message });
  }
});

x402Routes.get('/:gigId/purchase', (req, res) => {
  const db = getDb();
  const gig = db.prepare('SELECT * FROM gigs WHERE id = ? AND status = ?').get(req.params.gigId, 'active') as any;
  if (!gig) { db.close(); return res.status(404).json({ error: 'Gig not found' }); }
  db.close();

  const payTo = getEscrowAddr();

  res.json({
    gigId: gig.id, title: gig.title, protocol: 'x402', version: '2', network: NETWORK, payTo,
    pricing: {
      basic: { price: '$' + gig.price_basic, description: gig.title + ' - Basic' },
      ...(gig.price_standard ? { standard: { price: '$' + gig.price_standard, description: gig.title + ' - Standard' } } : {}),
      ...(gig.price_premium ? { premium: { price: '$' + gig.price_premium, description: gig.title + ' - Premium' } } : {}),
    },
    endpoint: 'https://gigent.xyz/api/gigs/' + gig.id + '/purchase',
    method: 'POST',
    facilitator: FACILITATOR_URL,
    instructions: 'POST to endpoint. If no PAYMENT-SIGNATURE header, returns 402 with payment requirements. Include signed payment in PAYMENT-SIGNATURE header to complete purchase.',
  });
});
