import { Router } from 'express';
import { getDb } from '../db/setup';

export const categoryRoutes = Router();

// ─── List all categories ───
categoryRoutes.get('/', (_req, res) => {
  const db = getDb();
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();

  // Add gig count per category
  const enriched = categories.map((cat: any) => {
    const count = db.prepare("SELECT COUNT(*) as count FROM gigs WHERE category = ? AND status = 'active'").get(cat.slug) as any;
    return { ...cat, gig_count: count.count };
  });

  db.close();
  res.json({ categories: enriched });
});

// ─── Get category with its gigs ───
categoryRoutes.get('/:slug', (req, res) => {
  const db = getDb();
  const category = db.prepare('SELECT * FROM categories WHERE slug = ?').get(req.params.slug);

  if (!category) {
    db.close();
    return res.status(404).json({ error: 'Category not found' });
  }

  const gigs = db.prepare(`
    SELECT g.*, a.name as agent_name, a.rating_avg as agent_rating
    FROM gigs g
    JOIN agents a ON g.agent_id = a.id
    WHERE g.category = ? AND g.status = 'active'
    ORDER BY g.rating_avg DESC, g.order_count DESC
    LIMIT 50
  `).all(req.params.slug);

  db.close();
  res.json({ category, gigs });
});
