import { Router } from 'express';
import { getDb } from '../db/setup';
import { ethers } from 'ethers';

export const reputationRoutes = Router();

const REPUTATION_REGISTRY = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63';
const BASE_RPC = 'https://mainnet.base.org';

import mapping from '../erc8004-mapping.json';

const REPUTATION_ABI = [
  'function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)',
  'function getClients(uint256 agentId) view returns (address[])',
  'function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)',
  'function readAllFeedback(uint256 agentId, address[] clientAddresses, string tag1, string tag2, bool includeRevoked) view returns (address[] clients, uint64[] feedbackIndexes, int128[] values, uint8[] valueDecimals, string[] tag1s, string[] tag2s, bool[] revokedStatuses)',
];

function getContract() {
  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  return new ethers.Contract(REPUTATION_REGISTRY, REPUTATION_ABI, provider);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Cache for reputation data (5 min TTL)
const repCache = new Map<string, { data: any; ts: number }>();
const REP_CACHE_TTL = 300_000;

async function getClientsWithRetry(contract: any, agentId: number, retries = 2): Promise<string[]> {
  for (let i = 0; i <= retries; i++) {
    try {
      const raw = await contract.getClients(agentId);
      return Array.from(raw);
    } catch (e: any) {
      if (i < retries && (e.message?.includes('429') || e.message?.includes('rate limit'))) {
        await sleep(600 * (i + 1));
        continue;
      }
      return [];
    }
  }
  return [];
}

function getAgentId(agentName: string): number | null {
  return (mapping as any).agents[agentName] || null;
}

// ─── GET /reputation/:agentName — Read on-chain reputation ───
reputationRoutes.get('/:agentName', async (req, res) => {
  try {
    const { agentName } = req.params;
    // Skip if this looks like a sub-route
    if (agentName === 'orders') return (res as any).status(404).json({ error: 'Use /reputation/orders/:id/feedback-params' });

    const agentId = getAgentId(agentName);
    if (!agentId) return res.status(404).json({ error: 'Agent not found in ERC-8004 registry' });

    const contract = getContract();

    const clients = await getClientsWithRetry(contract, agentId);
    if (clients.length === 0) {
      return res.json({
        agentId, agentName, onChain: true,
        feedbackCount: 0, averageScore: null,
        registry: REPUTATION_REGISTRY, chain: 'eip155:8453',
      });
    }

    const summary = await contract.getSummary(agentId, clients, '', '');
    const count = Number(summary[0]);
    const value = Number(summary[1]);
    const decimals = Number(summary[2]);

    return res.json({
      agentId, agentName, onChain: true,
      feedbackCount: count,
      averageScore: decimals > 0 ? value / (10 ** decimals) : value,
      scoreDecimals: decimals,
      registry: REPUTATION_REGISTRY, chain: 'eip155:8453',
    });
  } catch (e: any) {
    console.error('Reputation read error:', e.message);
    return res.status(500).json({ error: 'Failed to read on-chain reputation' });
  }
});

// ─── GET /orders/:orderId/feedback-params ───
reputationRoutes.get('/orders/:orderId/feedback-params', async (req, res) => {
  try {
    const db = getDb();
    const order = db.prepare(`
      SELECT o.*, s.name as seller_name, s.id as seller_uuid, b.wallet_address as buyer_wallet
      FROM orders o
      JOIN agents s ON o.seller_id = s.id
      JOIN agents b ON o.buyer_id = b.id
      WHERE o.id = ?
    `).get(req.params.orderId) as any;
    db.close();

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'completed' && order.status !== 'archived') {
      return res.status(400).json({ error: 'Order must be completed before leaving feedback' });
    }

    const sellerAgentId = getAgentId(order.seller_name);
    if (!sellerAgentId) return res.status(400).json({ error: 'Seller not registered in ERC-8004' });

    return res.json({
      contract: {
        address: REPUTATION_REGISTRY,
        chain: 'eip155:8453', chainId: 8453,
        function: 'giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)',
        abi: REPUTATION_ABI,
      },
      params: {
        agentId: sellerAgentId,
        valueDecimals: 0,
        tag1: 'gigent-order', tag2: order.tier || 'basic',
        endpoint: `https://gigent.xyz/api/agents/${order.seller_uuid}`,
        feedbackURI: `https://gigent.xyz/api/orders/${order.id}`,
        feedbackHash: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({
          orderId: order.id, price: order.price, tier: order.tier, completedAt: order.completed_at,
        }))),
      },
      scoring: { description: 'Score 0-100 where 100 is best', min: 0, max: 100 },
      buyer: { wallet: order.buyer_wallet, note: 'Transaction must be signed by this wallet' },
    });
  } catch (e: any) {
    console.error('Feedback params error:', e.message);
    return res.status(500).json({ error: 'Failed to generate feedback params' });
  }
});

// ─── POST /orders/:orderId/feedback — Record on-chain feedback tx ───
reputationRoutes.post('/orders/:orderId/feedback', async (req, res) => {
  try {
    const { tx_hash, score } = req.body;
    if (!tx_hash) return res.status(400).json({ error: 'tx_hash required' });

    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId) as any;
    if (!order) { db.close(); return res.status(404).json({ error: 'Order not found' }); }

    const cols = db.prepare("PRAGMA table_info(orders)").all() as any[];
    if (!cols.find((c: any) => c.name === 'feedback_tx_hash')) {
      db.exec('ALTER TABLE orders ADD COLUMN feedback_tx_hash TEXT');
    }

    db.prepare('UPDATE orders SET feedback_tx_hash = ? WHERE id = ?').run(tx_hash, req.params.orderId);

    if (score) {
      const rating = Math.max(1, Math.min(5, Math.round(score / 20)));
      const existing = db.prepare('SELECT id FROM reviews WHERE order_id = ?').get(req.params.orderId) as any;
      if (!existing) {
        const { v4: uuid } = require('uuid');
        db.prepare('INSERT INTO reviews (id, order_id, reviewer_id, reviewed_id, gig_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(uuid(), order.id, order.buyer_id, order.seller_id, order.gig_id, rating, `On-chain feedback: ${score}/100 (tx: ${tx_hash.slice(0, 10)}...)`);
      }
    }
    db.close();

    return res.json({ success: true, orderId: req.params.orderId, feedbackTxHash: tx_hash, basescanUrl: `https://basescan.org/tx/${tx_hash}` });
  } catch (e: any) {
    console.error('Feedback record error:', e.message);
    return res.status(500).json({ error: 'Failed to record feedback' });
  }
});

// ─── GET /reputation/:agentName/details ───
reputationRoutes.get('/:agentName/details', async (req, res) => {
  try {
    const { agentName } = req.params;
    const agentId = getAgentId(agentName);
    if (!agentId) return res.status(404).json({ error: 'Agent not found in ERC-8004 registry' });

    const contract = getContract();
    let clients: string[];
    try {
      clients = Array.from(await contract.getClients(agentId));
    } catch { clients = []; }

    if (clients.length === 0) return res.json({ agentId, agentName, feedback: [] });

    const all = await contract.readAllFeedback(agentId, clients, '', '', false);
    const feedback = Array.from(all[0]).map((client: any, i: number) => ({
      client,
      index: Number(all[1][i]),
      value: Number(all[2][i]),
      decimals: Number(all[3][i]),
      tag1: all[4][i],
      tag2: all[5][i],
      revoked: all[6][i],
    }));

    return res.json({ agentId, agentName, feedback });
  } catch (e: any) {
    console.error('Feedback details error:', e.message);
    return res.status(500).json({ error: 'Failed to read feedback details' });
  }
});

// ─── GET /all — Batch reputation for all registered agents ───
reputationRoutes.get('/', async (_req, res) => {
  try {
    // Return full cache if fresh
    const cacheKey = '__batch__';
    const cached = repCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < REP_CACHE_TTL) {
      return res.json(cached.data);
    }

    const contract = getContract();
    const agents = (mapping as any).agents as Record<string, number>;
    const results: any[] = [];

    for (const [name, agentId] of Object.entries(agents)) {
      try {
        const clients = await getClientsWithRetry(contract, agentId);
        if (clients.length === 0) {
          results.push({ agentId, agentName: name, feedbackCount: 0, averageScore: null });
        } else {
          const summary = await contract.getSummary(agentId, clients, '', '');
          results.push({
            agentId, agentName: name,
            feedbackCount: Number(summary[0]),
            averageScore: Number(summary[2]) > 0 ? Number(summary[1]) / (10 ** Number(summary[2])) : Number(summary[1]),
          });
        }
      } catch {
        results.push({ agentId, agentName: name, feedbackCount: 0, averageScore: null });
      }
      // Delay between agents to avoid 429
      await sleep(200);
    }

    const response = { agents: results, registry: REPUTATION_REGISTRY, chain: 'eip155:8453' };
    repCache.set(cacheKey, { data: response, ts: Date.now() });
    return res.json(response);
  } catch (e: any) {
    console.error('Batch reputation error:', e.message);
    return res.status(500).json({ error: 'Failed to read batch reputation' });
  }
});
