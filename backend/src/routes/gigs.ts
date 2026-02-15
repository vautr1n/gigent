import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/setup';
import { optionalApiKey } from '../middleware/auth';

export const gigRoutes = Router();

// ─── Publish a new gig ───
gigRoutes.post('/', optionalApiKey, (req, res) => {
  try {
    const {
      agent_id: body_agent_id, title, description, category, subcategory, tags,
      price_basic, price_standard, price_premium,
      desc_basic, desc_standard, desc_premium,
      delivery_time_hours, max_revisions,
      example_input, example_output, api_schema,
    } = req.body;

    // Use authenticated agent or fallback to body
    const agent_id = (req as any).agent?.id || body_agent_id;

    if (!agent_id || !title || !description || !category || !price_basic || !desc_basic) {
      return res.status(400).json({
        error: 'Required fields: agent_id, title, description, category, price_basic, desc_basic',
      });
    }

    const db = getDb();

    // Verify agent exists
    const agent = db.prepare('SELECT id FROM agents WHERE id = ?').get(agent_id);
    if (!agent) {
      db.close();
      return res.status(404).json({ error: 'Agent not found' });
    }

    const id = uuid();

    db.prepare(`
      INSERT INTO gigs (
        id, agent_id, title, description, category, subcategory, tags,
        price_basic, price_standard, price_premium,
        desc_basic, desc_standard, desc_premium,
        delivery_time_hours, max_revisions,
        example_input, example_output, api_schema
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, agent_id, title, description, category, subcategory || null, JSON.stringify(tags || []),
      price_basic, price_standard || null, price_premium || null,
      desc_basic, desc_standard || null, desc_premium || null,
      delivery_time_hours || 1, max_revisions || 1,
      example_input || null, example_output || null, api_schema ? JSON.stringify(api_schema) : null,
    );

    const gig = db.prepare('SELECT * FROM gigs WHERE id = ?').get(id);
    db.close();

    console.log(`📦 New gig published: "${title}" by agent ${agent_id}`);
    res.status(201).json(gig);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get single gig ───
gigRoutes.get('/:id', (req, res) => {
  const db = getDb();
  const gig = db.prepare(`
    SELECT g.*, a.name as agent_name, a.rating_avg as agent_rating, a.total_orders_completed as agent_orders
    FROM gigs g
    JOIN agents a ON g.agent_id = a.id
    WHERE g.id = ?
  `).get(req.params.id);

  if (!gig) {
    db.close();
    return res.status(404).json({ error: 'Gig not found' });
  }

  // Get reviews for this gig
  const reviews = db.prepare(`
    SELECT r.*, a.name as reviewer_name
    FROM reviews r
    JOIN agents a ON r.reviewer_id = a.id
    WHERE r.gig_id = ?
    ORDER BY r.created_at DESC
    LIMIT 20
  `).all(req.params.id);

  db.close();
  res.json({ ...(gig as any), reviews });
});

// ─── Browse / search gigs ───
gigRoutes.get('/', (req, res) => {
  const { category, subcategory, search, min_price, max_price, sort, agent_id, limit, offset } = req.query;
  const db = getDb();

  let query = `
    SELECT g.*, a.name as agent_name, a.rating_avg as agent_rating
    FROM gigs g
    JOIN agents a ON g.agent_id = a.id
    WHERE g.status = 'active'
  `;
  const params: any[] = [];

  if (category) { query += ' AND g.category = ?'; params.push(category); }
  if (subcategory) { query += ' AND g.subcategory = ?'; params.push(subcategory); }
  if (agent_id) { query += ' AND g.agent_id = ?'; params.push(agent_id); }
  if (min_price) { query += ' AND g.price_basic >= ?'; params.push(Number(min_price)); }
  if (max_price) { query += ' AND g.price_basic <= ?'; params.push(Number(max_price)); }
  if (search) {
    query += ' AND (g.title LIKE ? OR g.description LIKE ? OR g.tags LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  // Sort
  if (sort === 'price_low') query += ' ORDER BY g.price_basic ASC';
  else if (sort === 'price_high') query += ' ORDER BY g.price_basic DESC';
  else if (sort === 'rating') query += ' ORDER BY g.rating_avg DESC';
  else if (sort === 'popular') query += ' ORDER BY g.order_count DESC';
  else query += ' ORDER BY g.rating_avg DESC, g.order_count DESC'; // Best match

  query += ' LIMIT ? OFFSET ?';
  params.push(Number(limit) || 20, Number(offset) || 0);

  const gigs = db.prepare(query).all(...params);

  // Total count for pagination
  let countQuery = "SELECT COUNT(*) as count FROM gigs WHERE status = 'active'";
  const countParams: any[] = [];
  if (category) { countQuery += ' AND category = ?'; countParams.push(category); }

  const total = db.prepare(countQuery).get(...countParams) as any;
  db.close();

  res.json({ gigs, total: total.count });
});

// ─── Update gig ───
gigRoutes.patch('/:id', (req, res) => {
  const allowedFields = [
    'title', 'description', 'category', 'subcategory', 'tags',
    'price_basic', 'price_standard', 'price_premium',
    'desc_basic', 'desc_standard', 'desc_premium',
    'delivery_time_hours', 'max_revisions', 'status',
    'example_input', 'example_output',
  ];

  const db = getDb();
  const updates: string[] = [];
  const params: any[] = [];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      const val = field === 'tags' ? JSON.stringify(req.body[field]) : req.body[field];
      params.push(val);
    }
  }

  if (updates.length === 0) {
    db.close();
    return res.status(400).json({ error: 'Nothing to update' });
  }

  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE gigs SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const gig = db.prepare('SELECT * FROM gigs WHERE id = ?').get(req.params.id);
  db.close();

  res.json(gig);
});

// ─── Delete gig (soft) ───
gigRoutes.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE gigs SET status = 'deleted', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  db.close();
  res.json({ success: true });
});
