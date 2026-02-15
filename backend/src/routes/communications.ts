import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/setup';
import { ethers } from 'ethers';

export const communicationRoutes = Router();

const REPUTATION_REGISTRY = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63';
const BASE_URL = process.env.BASE_URL || 'https://gigent.xyz';

import mapping from '../erc8004-mapping.json';

function getAgentId(agentName: string): number | null {
  return (mapping as any).agents[agentName] || null;
}

// ─── DB Migration: ensure work_submissions table exists ───
function ensureTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_submissions (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES agents(id),
      receiver_id TEXT NOT NULL REFERENCES agents(id),
      order_id TEXT REFERENCES orders(id),
      title TEXT NOT NULL,
      description TEXT,
      payload TEXT,
      payload_type TEXT DEFAULT 'text',
      status TEXT NOT NULL DEFAULT 'pending',
      score INTEGER,
      score_comment TEXT,
      feedback_tx_hash TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ws_sender ON work_submissions(sender_id);
    CREATE INDEX IF NOT EXISTS idx_ws_receiver ON work_submissions(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_ws_status ON work_submissions(status);
    CREATE INDEX IF NOT EXISTS idx_ws_order ON work_submissions(order_id);
  `);
  db.close();
}

ensureTable();

// ─── POST / — Submit work to another agent ───
communicationRoutes.post('/', (req, res) => {
  try {
    const { sender_id, receiver_id, order_id, title, description, payload, payload_type } = req.body;

    if (!sender_id || !receiver_id || !title) {
      return res.status(400).json({ error: 'sender_id, receiver_id, and title are required' });
    }

    const db = getDb();

    const sender = db.prepare('SELECT id, name FROM agents WHERE id = ?').get(sender_id) as any;
    if (!sender) { db.close(); return res.status(404).json({ error: 'Sender agent not found' }); }

    const receiver = db.prepare('SELECT id, name FROM agents WHERE id = ?').get(receiver_id) as any;
    if (!receiver) { db.close(); return res.status(404).json({ error: 'Receiver agent not found' }); }

    if (sender_id === receiver_id) {
      db.close();
      return res.status(400).json({ error: 'Cannot submit work to yourself' });
    }

    const id = uuid();
    db.prepare(`
      INSERT INTO work_submissions (id, sender_id, receiver_id, order_id, title, description, payload, payload_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, sender_id, receiver_id, order_id || null, title, description || null, payload || null, payload_type || 'text');

    const submission = db.prepare('SELECT * FROM work_submissions WHERE id = ?').get(id) as any;
    db.close();

    console.log(`[comm] ${sender.name} -> ${receiver.name}: "${title}"`);

    res.status(201).json({
      ...submission,
      sender_name: sender.name,
      receiver_name: receiver.name,
      _links: {
        review: `${BASE_URL}/api/communications/${id}/review`,
        self: `${BASE_URL}/api/communications/${id}`,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET / — List work submissions (filtered) ───
communicationRoutes.get('/', (req, res) => {
  try {
    const { agent_id, role, status, order_id, limit, offset } = req.query;
    const db = getDb();

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (agent_id && role === 'sender') {
      where += ' AND ws.sender_id = ?';
      params.push(agent_id);
    } else if (agent_id && role === 'receiver') {
      where += ' AND ws.receiver_id = ?';
      params.push(agent_id);
    } else if (agent_id) {
      where += ' AND (ws.sender_id = ? OR ws.receiver_id = ?)';
      params.push(agent_id, agent_id);
    }

    if (status) { where += ' AND ws.status = ?'; params.push(status); }
    if (order_id) { where += ' AND ws.order_id = ?'; params.push(order_id); }

    const lim = Math.min(Number(limit) || 50, 100);
    const off = Number(offset) || 0;

    const submissions = db.prepare(`
      SELECT ws.*,
        s.name as sender_name, s.wallet_address as sender_wallet,
        r.name as receiver_name, r.wallet_address as receiver_wallet
      FROM work_submissions ws
      JOIN agents s ON ws.sender_id = s.id
      JOIN agents r ON ws.receiver_id = r.id
      ${where}
      ORDER BY ws.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, lim, off) as any[];

    const total = db.prepare(`SELECT COUNT(*) as count FROM work_submissions ws ${where}`).get(...params) as any;
    db.close();

    res.json({ submissions, total: total.count, limit: lim, offset: off });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /:id — Get a specific submission ───
communicationRoutes.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const submission = db.prepare(`
      SELECT ws.*,
        s.name as sender_name, s.wallet_address as sender_wallet,
        r.name as receiver_name, r.wallet_address as receiver_wallet
      FROM work_submissions ws
      JOIN agents s ON ws.sender_id = s.id
      JOIN agents r ON ws.receiver_id = r.id
      WHERE ws.id = ?
    `).get(req.params.id) as any;
    db.close();

    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const senderAgentId = getAgentId(submission.sender_name);
    res.json({
      ...submission,
      erc8004: senderAgentId ? {
        agentId: senderAgentId,
        canRateOnChain: true,
        ratingEndpoint: `${BASE_URL}/api/communications/${submission.id}/review`,
        reputationRegistry: REPUTATION_REGISTRY,
        chain: 'eip155:8453',
      } : { canRateOnChain: false },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/review — Review/rate a work submission (with ERC-8004 feedback) ───
communicationRoutes.post('/:id/review', (req, res) => {
  try {
    const { reviewer_id, score, comment, feedback_tx_hash } = req.body;

    if (!reviewer_id || score === undefined) {
      return res.status(400).json({ error: 'reviewer_id and score (0-100) are required' });
    }

    const scoreNum = Number(score);
    if (scoreNum < 0 || scoreNum > 100) {
      return res.status(400).json({ error: 'Score must be 0-100' });
    }

    const db = getDb();
    const submission = db.prepare(`
      SELECT ws.*, s.name as sender_name, r.name as receiver_name
      FROM work_submissions ws
      JOIN agents s ON ws.sender_id = s.id
      JOIN agents r ON ws.receiver_id = r.id
      WHERE ws.id = ?
    `).get(req.params.id) as any;

    if (!submission) { db.close(); return res.status(404).json({ error: 'Submission not found' }); }
    if (submission.receiver_id !== reviewer_id) { db.close(); return res.status(403).json({ error: 'Only the receiver can review this submission' }); }
    if (submission.status === 'reviewed') { db.close(); return res.status(409).json({ error: 'Already reviewed' }); }

    db.prepare(`
      UPDATE work_submissions
      SET status = 'reviewed', score = ?, score_comment = ?, feedback_tx_hash = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(scoreNum, comment || null, feedback_tx_hash || null, req.params.id);

    const updated = db.prepare('SELECT * FROM work_submissions WHERE id = ?').get(req.params.id);

    // If linked to an order, also create a review in the reviews table
    if (submission.order_id) {
      const existing = db.prepare('SELECT id FROM reviews WHERE order_id = ?').get(submission.order_id) as any;
      if (!existing) {
        const starRating = Math.max(1, Math.min(5, Math.round(scoreNum / 20)));
        db.prepare('INSERT INTO reviews (id, order_id, reviewer_id, reviewed_id, gig_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(uuid(), submission.order_id, reviewer_id, submission.sender_id,
            (db.prepare('SELECT gig_id FROM orders WHERE id = ?').get(submission.order_id) as any)?.gig_id,
            starRating, comment || `Work submission rated ${scoreNum}/100`);
      }
    }

    db.close();

    // Build ERC-8004 feedback params for on-chain submission
    const senderAgentId = getAgentId(submission.sender_name);
    const erc8004Feedback = senderAgentId ? {
      ready: true,
      contract: REPUTATION_REGISTRY,
      chain: 'eip155:8453',
      chainId: 8453,
      params: {
        agentId: senderAgentId,
        value: scoreNum,
        valueDecimals: 0,
        tag1: 'gigent-work',
        tag2: 'submission',
        endpoint: `${BASE_URL}/api/agents/${submission.sender_id}`,
        feedbackURI: `${BASE_URL}/api/communications/${submission.id}`,
        feedbackHash: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({
          submissionId: submission.id, score: scoreNum, reviewedAt: new Date().toISOString(),
        }))),
      },
      instructions: 'Call giveFeedback() on the reputation registry contract with these params to record the rating on-chain.',
    } : { ready: false, reason: 'Sender not registered in ERC-8004 identity registry' };

    console.log(`[comm] Review: ${submission.receiver_name} rated ${submission.sender_name} ${scoreNum}/100`);

    res.json({
      submission: updated,
      erc8004Feedback,
      ...(feedback_tx_hash ? { basescanUrl: `https://basescan.org/tx/${feedback_tx_hash}` } : {}),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/record-feedback — Record on-chain feedback tx hash after submission ───
communicationRoutes.post('/:id/record-feedback', (req, res) => {
  try {
    const { tx_hash } = req.body;
    if (!tx_hash) return res.status(400).json({ error: 'tx_hash required' });

    const db = getDb();
    const submission = db.prepare('SELECT * FROM work_submissions WHERE id = ?').get(req.params.id) as any;
    if (!submission) { db.close(); return res.status(404).json({ error: 'Submission not found' }); }

    db.prepare('UPDATE work_submissions SET feedback_tx_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(tx_hash, req.params.id);
    db.close();

    res.json({ success: true, submissionId: req.params.id, feedbackTxHash: tx_hash, basescanUrl: `https://basescan.org/tx/${tx_hash}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /agent/:agentId/inbox — Get pending work submissions for an agent ───
communicationRoutes.get('/agent/:agentId/inbox', (req, res) => {
  try {
    const db = getDb();
    const submissions = db.prepare(`
      SELECT ws.*, s.name as sender_name, s.wallet_address as sender_wallet
      FROM work_submissions ws
      JOIN agents s ON ws.sender_id = s.id
      WHERE ws.receiver_id = ? AND ws.status = 'pending'
      ORDER BY ws.created_at DESC
    `).all(req.params.agentId) as any[];
    db.close();

    res.json({ inbox: submissions, count: submissions.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /agent/:agentId/sent — Get work submissions sent by an agent ───
communicationRoutes.get('/agent/:agentId/sent', (req, res) => {
  try {
    const db = getDb();
    const submissions = db.prepare(`
      SELECT ws.*, r.name as receiver_name, r.wallet_address as receiver_wallet
      FROM work_submissions ws
      JOIN agents r ON ws.receiver_id = r.id
      WHERE ws.sender_id = ?
      ORDER BY ws.created_at DESC
    `).all(req.params.agentId) as any[];
    db.close();

    res.json({ sent: submissions, count: submissions.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
