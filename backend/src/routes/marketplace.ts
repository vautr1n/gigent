import { Router } from 'express';
import { getDb } from '../db/setup';
import erc8004Mapping from '../erc8004-mapping.json';

export const marketplaceRoutes = Router();

function enrichWithErc8004(agent: any): any {
  if (!agent?.name) return agent;
  const erc8004Id = (erc8004Mapping as any).agents[agent.name] || null;
  return { ...agent, erc8004_id: erc8004Id };
}

// ─── Featured / homepage data ───
marketplaceRoutes.get('/featured', (_req, res) => {
  const db = getDb();

  // Top rated gigs
  const topRated = db.prepare(`
    SELECT g.*, a.name as agent_name, a.rating_avg as agent_rating
    FROM gigs g JOIN agents a ON g.agent_id = a.id
    WHERE g.status = 'active' AND g.rating_count > 0
    ORDER BY g.rating_avg DESC
    LIMIT 6
  `).all();

  // Most popular gigs
  const popular = db.prepare(`
    SELECT g.*, a.name as agent_name, a.rating_avg as agent_rating
    FROM gigs g JOIN agents a ON g.agent_id = a.id
    WHERE g.status = 'active'
    ORDER BY g.order_count DESC
    LIMIT 6
  `).all();

  // Newest gigs
  const newest = db.prepare(`
    SELECT g.*, a.name as agent_name, a.rating_avg as agent_rating
    FROM gigs g JOIN agents a ON g.agent_id = a.id
    WHERE g.status = 'active'
    ORDER BY g.created_at DESC
    LIMIT 6
  `).all();

  // Top agents
  const topAgents = db.prepare(`
    SELECT * FROM agents
    WHERE status = 'active' AND total_orders_completed > 0
    ORDER BY rating_avg DESC
    LIMIT 6
  `).all();

  // Categories with counts
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  const enrichedCats = categories.map((cat: any) => {
    const count = db.prepare("SELECT COUNT(*) as c FROM gigs WHERE category = ? AND status = 'active'").get(cat.slug) as any;
    return { ...cat, gig_count: count.c };
  });

  // Global stats
  const stats = {
    total_agents: (db.prepare("SELECT COUNT(*) as c FROM agents WHERE status = 'active'").get() as any).c,
    total_gigs: (db.prepare("SELECT COUNT(*) as c FROM gigs WHERE status = 'active'").get() as any).c,
    total_orders: (db.prepare('SELECT COUNT(*) as c FROM orders').get() as any).c,
    total_completed: (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'completed'").get() as any).c,
    total_volume: (db.prepare("SELECT COALESCE(SUM(price), 0) as v FROM orders WHERE status = 'completed'").get() as any).v,
  };

  db.close();

  res.json({
    top_rated: topRated,
    popular,
    newest,
    top_agents: topAgents.map(enrichWithErc8004),
    categories: enrichedCats,
    stats,
  });
});

// ─── Search across everything ───
marketplaceRoutes.get('/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter "q" required' });

  const db = getDb();
  const searchTerm = `%${q}%`;

  const gigs = db.prepare(`
    SELECT g.*, a.name as agent_name
    FROM gigs g JOIN agents a ON g.agent_id = a.id
    WHERE g.status = 'active' AND (g.title LIKE ? OR g.description LIKE ? OR g.tags LIKE ?)
    ORDER BY g.rating_avg DESC
    LIMIT 20
  `).all(searchTerm, searchTerm, searchTerm);

  const agents = db.prepare(`
    SELECT * FROM agents
    WHERE status = 'active' AND (name LIKE ? OR description LIKE ?)
    LIMIT 10
  `).all(searchTerm, searchTerm);

  db.close();
  res.json({ gigs, agents: agents.map(enrichWithErc8004), query: q });
});

// ─── Marketplace stats ───
marketplaceRoutes.get('/stats', (_req, res) => {
  const db = getDb();

  const stats = {
    agents: {
      total: (db.prepare("SELECT COUNT(*) as c FROM agents WHERE status = 'active'").get() as any).c,
      new_this_week: (db.prepare("SELECT COUNT(*) as c FROM agents WHERE created_at > datetime('now', '-7 days')").get() as any).c,
    },
    gigs: {
      total: (db.prepare("SELECT COUNT(*) as c FROM gigs WHERE status = 'active'").get() as any).c,
      by_category: db.prepare(`
        SELECT category, COUNT(*) as count 
        FROM gigs WHERE status = 'active' 
        GROUP BY category ORDER BY count DESC
      `).all(),
    },
    orders: {
      total: (db.prepare('SELECT COUNT(*) as c FROM orders').get() as any).c,
      completed: (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'completed'").get() as any).c,
      pending: (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").get() as any).c,
      in_progress: (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status IN ('accepted', 'in_progress')").get() as any).c,
      total_volume_usdc: (db.prepare("SELECT COALESCE(SUM(price), 0) as v FROM orders WHERE status = 'completed'").get() as any).v,
    },
    reviews: {
      total: (db.prepare('SELECT COUNT(*) as c FROM reviews').get() as any).c,
      average_rating: (db.prepare('SELECT COALESCE(AVG(rating), 0) as avg FROM reviews').get() as any).avg,
    },
  };

  db.close();
  res.json(stats);
});
