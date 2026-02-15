import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/setup';
import { submitReviewOnChain, isReviewContractConfigured } from '../services/contracts';

export const reviewRoutes = Router();

// ─── Submit a review ───
reviewRoutes.post('/', (req, res) => {
  try {
    const { order_id, reviewer_id, rating, comment, quality_rating, speed_rating, value_rating } = req.body;

    if (!order_id || !reviewer_id || !rating) {
      return res.status(400).json({ error: 'Required: order_id, reviewer_id, rating (1-5)' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const db = getDb();

    // Verify order exists and is completed
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id) as any;
    if (!order) {
      db.close();
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.status !== 'completed') {
      db.close();
      return res.status(400).json({ error: 'Can only review completed orders' });
    }
    if (order.buyer_id !== reviewer_id) {
      db.close();
      return res.status(403).json({ error: 'Only the buyer can review' });
    }

    const id = uuid();

    db.prepare(`
      INSERT INTO reviews (id, order_id, reviewer_id, reviewed_id, gig_id, rating, comment, quality_rating, speed_rating, value_rating)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, order_id, reviewer_id, order.seller_id, order.gig_id, rating, comment || null, quality_rating || null, speed_rating || null, value_rating || null);

    // Update agent rating
    const agentReviews = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE reviewed_id = ?').get(order.seller_id) as any;
    db.prepare('UPDATE agents SET rating_avg = ?, rating_count = ? WHERE id = ?').run(agentReviews.avg, agentReviews.count, order.seller_id);

    // Update gig rating
    const gigReviews = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE gig_id = ?').get(order.gig_id) as any;
    db.prepare('UPDATE gigs SET rating_avg = ?, rating_count = ? WHERE id = ?').run(gigReviews.avg, gigReviews.count, order.gig_id);

    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);

    // Get wallet addresses for on-chain review
    const reviewerAgent = db.prepare('SELECT wallet_address FROM agents WHERE id = ?').get(reviewer_id) as any;
    const reviewedAgent = db.prepare('SELECT wallet_address FROM agents WHERE id = ?').get(order.seller_id) as any;
    db.close();

    console.log(`⭐ Review submitted: ${rating}/5 for order ${order_id}`);

    // Fire-and-forget: submit review on-chain via ReviewSystem
    if (isReviewContractConfigured() && reviewerAgent?.wallet_address && reviewedAgent?.wallet_address) {
      submitReviewOnChain(order_id, reviewerAgent.wallet_address, reviewedAgent.wallet_address, rating).catch((err: any) => {
        console.error(`[Contract] Failed to submit review on-chain: ${err.message}`);
      });
    }

    res.status(201).json(review);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Order already reviewed' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── Get all reviews ───
reviewRoutes.get('/', (_req, res) => {
  const db = getDb();
  const reviews = db.prepare(`
    SELECT r.*, a.name as reviewer_name, g.title as gig_title
    FROM reviews r
    LEFT JOIN agents a ON r.reviewer_id = a.id
    LEFT JOIN gigs g ON r.gig_id = g.id
    ORDER BY r.created_at DESC
    LIMIT 50
  `).all();
  db.close();
  res.json(reviews);
});

// ─── Get reviews for an agent ───
reviewRoutes.get('/agent/:agent_id', (req, res) => {
  const db = getDb();
  const reviews = db.prepare(`
    SELECT r.*, a.name as reviewer_name, g.title as gig_title
    FROM reviews r
    JOIN agents a ON r.reviewer_id = a.id
    JOIN gigs g ON r.gig_id = g.id
    WHERE r.reviewed_id = ?
    ORDER BY r.created_at DESC
    LIMIT 50
  `).all(req.params.agent_id);
  db.close();
  res.json({ reviews });
});

// ─── Get reviews for a gig ───
reviewRoutes.get('/gig/:gig_id', (req, res) => {
  const db = getDb();
  const reviews = db.prepare(`
    SELECT r.*, a.name as reviewer_name
    FROM reviews r
    JOIN agents a ON r.reviewer_id = a.id
    WHERE r.gig_id = ?
    ORDER BY r.created_at DESC
    LIMIT 50
  `).all(req.params.gig_id);
  db.close();
  res.json({ reviews });
});
