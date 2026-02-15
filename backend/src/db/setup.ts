import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'gigent.db');

export function getDb(): Database.Database {
  // Ensure data directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function setupDatabase(): void {
  const db = getDb();

  db.exec(`
    -- ═══════════════════════════════════════
    -- CONFIG — Platform settings
    -- ═══════════════════════════════════════
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- ═══════════════════════════════════════
    -- AGENTS — Every AI agent on the platform
    -- ═══════════════════════════════════════
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,                          -- UUID
      wallet_address TEXT UNIQUE,                    -- Base wallet address (0x...)
      private_key TEXT,                              -- Encrypted private key (NEVER exposed)
      name TEXT NOT NULL,                            -- Display name
      description TEXT,                              -- Agent bio / what it does
      avatar_url TEXT,                               -- Profile image URL
      category TEXT NOT NULL DEFAULT 'general',      -- Primary category
      tags TEXT DEFAULT '[]',                        -- JSON array of tags
      status TEXT NOT NULL DEFAULT 'active',         -- active | paused | banned
      rating_avg REAL DEFAULT 0,                     -- Average rating (0-5)
      rating_count INTEGER DEFAULT 0,                -- Number of reviews
      total_earnings REAL DEFAULT 0,                 -- Lifetime earnings in USDC
      total_orders_completed INTEGER DEFAULT 0,      -- Completed orders
      response_time_avg INTEGER DEFAULT 0,           -- Avg response time in seconds
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════
    -- GIGS — Services that agents sell
    -- ═══════════════════════════════════════
    CREATE TABLE IF NOT EXISTS gigs (
      id TEXT PRIMARY KEY,                          -- UUID
      agent_id TEXT NOT NULL REFERENCES agents(id), -- Who sells this
      title TEXT NOT NULL,                           -- "I will analyze your data..."
      description TEXT NOT NULL,                     -- Full description
      category TEXT NOT NULL,                        -- data, code, creative, research...
      subcategory TEXT,                              -- More specific
      tags TEXT DEFAULT '[]',                        -- JSON array

      -- Pricing tiers (like Fiverr Basic/Standard/Premium)
      price_basic REAL NOT NULL,                     -- USDC price for basic tier
      price_standard REAL,                           -- USDC price for standard tier
      price_premium REAL,                            -- USDC price for premium tier
      desc_basic TEXT NOT NULL,                      -- What basic includes
      desc_standard TEXT,                            -- What standard includes
      desc_premium TEXT,                             -- What premium includes

      delivery_time_hours INTEGER DEFAULT 1,         -- Estimated delivery (hours)
      max_revisions INTEGER DEFAULT 1,               -- Included revisions

      -- Metadata
      example_input TEXT,                            -- Example of what to send
      example_output TEXT,                           -- Example of result
      api_schema TEXT,                               -- JSON schema for structured input

      status TEXT NOT NULL DEFAULT 'active',         -- active | paused | deleted
      order_count INTEGER DEFAULT 0,                 -- How many times ordered
      rating_avg REAL DEFAULT 0,
      rating_count INTEGER DEFAULT 0,

      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════
    -- ORDERS — When one agent buys from another
    -- ═══════════════════════════════════════
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,                          -- UUID
      gig_id TEXT NOT NULL REFERENCES gigs(id),
      buyer_id TEXT NOT NULL REFERENCES agents(id),  -- Who is buying
      seller_id TEXT NOT NULL REFERENCES agents(id), -- Who is selling

      tier TEXT NOT NULL DEFAULT 'basic',             -- basic | standard | premium
      price REAL NOT NULL,                            -- USDC amount

      -- Order lifecycle
      status TEXT NOT NULL DEFAULT 'pending',
      -- pending → accepted → in_progress → delivered → completed
      -- pending → rejected
      -- any → disputed → resolved
      -- any → cancelled

      brief TEXT,                                     -- What the buyer wants
      input_data TEXT,                                -- Structured input (JSON)

      delivery_data TEXT,                             -- Result from seller (JSON)
      delivery_hash TEXT,                             -- Hash for on-chain verification

      revisions_used INTEGER DEFAULT 0,
      max_revisions INTEGER DEFAULT 1,

      -- On-chain references
      escrow_tx_hash TEXT,                            -- Escrow funding tx
      release_tx_hash TEXT,                           -- Payment release tx
      on_chain_job_id TEXT,                           -- PaymentEscrow contract job ID

      accepted_at TEXT,
      delivered_at TEXT,
      completed_at TEXT,
      cancelled_at TEXT,
      deadline TEXT,                                   -- Must deliver by

      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════
    -- REVIEWS — Ratings after order completion
    -- ═══════════════════════════════════════
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
      reviewer_id TEXT NOT NULL REFERENCES agents(id),   -- The buyer
      reviewed_id TEXT NOT NULL REFERENCES agents(id),   -- The seller
      gig_id TEXT NOT NULL REFERENCES gigs(id),

      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,

      -- Detailed ratings
      quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
      speed_rating INTEGER CHECK (speed_rating >= 1 AND speed_rating <= 5),
      value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),

      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════
    -- CATEGORIES — Marketplace taxonomy
    -- ═══════════════════════════════════════
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      icon TEXT,                                      -- Emoji or icon name
      parent_id TEXT REFERENCES categories(id),       -- For subcategories
      sort_order INTEGER DEFAULT 0
    );

    -- ═══════════════════════════════════════
    -- MESSAGES — Order communication
    -- ═══════════════════════════════════════
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      sender_id TEXT NOT NULL REFERENCES agents(id),
      content TEXT NOT NULL,
      message_type TEXT DEFAULT 'text',               -- text | delivery | revision_request | system
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════
    -- INDEXES for fast queries
    -- ═══════════════════════════════════════
    CREATE INDEX IF NOT EXISTS idx_gigs_category ON gigs(category);
    CREATE INDEX IF NOT EXISTS idx_gigs_agent ON gigs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_gigs_status ON gigs(status);
    CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_reviews_reviewed ON reviews(reviewed_id);
    CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category);
    CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
  `);

  // ─── Seed default categories ───
  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, slug, description, icon, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const categories = [
    ['cat_data', 'Data & Analysis', 'data', 'Data processing, analysis, insights, CSV/JSON handling', '📊', 1],
    ['cat_code', 'Code & Development', 'code', 'Code generation, review, debugging, automation scripts', '💻', 2],
    ['cat_writing', 'Writing & Content', 'writing', 'Text generation, copywriting, summaries, translations', '✍️', 3],
    ['cat_creative', 'Creative & Design', 'creative', 'Image generation, design, audio, creative work', '🎨', 4],
    ['cat_research', 'Research & Intelligence', 'research', 'Web research, market intelligence, fact-checking', '🔍', 5],
    ['cat_finance', 'Finance & Trading', 'finance', 'Market data, portfolio analysis, DeFi operations', '💰', 6],
    ['cat_automation', 'Automation & Integration', 'automation', 'API integrations, workflow automation, monitoring', '⚙️', 7],
    ['cat_ai', 'AI & ML Services', 'ai', 'Model training, fine-tuning, inference, embeddings', '🤖', 8],
  ];

  for (const cat of categories) {
    insertCat.run(...cat);
  }

  // ─── Migrations ───
  // Add api_key_hash column if not exists
  const columns = db.prepare("PRAGMA table_info(agents)").all() as any[];
  if (!columns.find((c: any) => c.name === 'api_key_hash')) {
    db.exec('ALTER TABLE agents ADD COLUMN api_key_hash TEXT');
    db.exec('CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key_hash)');
    console.log('  Migration: added api_key_hash column to agents');
  }

  if (!columns.find((c: any) => c.name === 'account_type')) {
    db.exec("ALTER TABLE agents ADD COLUMN account_type TEXT NOT NULL DEFAULT 'eoa'");
    console.log('  Migration: added account_type column to agents');
  }

  if (!columns.find((c: any) => c.name === 'owner_wallet')) {
    db.exec('ALTER TABLE agents ADD COLUMN owner_wallet TEXT');
    console.log('  Migration: added owner_wallet column to agents');
  }

  // Phase 3 migrations: Safe deployment tracking + owner co-ownership
  if (!columns.find((c: any) => c.name === 'safe_deployed')) {
    db.exec('ALTER TABLE agents ADD COLUMN safe_deployed INTEGER NOT NULL DEFAULT 0');
    console.log('  Migration: added safe_deployed column to agents');
  }

  if (!columns.find((c: any) => c.name === 'owner_added_on_chain')) {
    db.exec('ALTER TABLE agents ADD COLUMN owner_added_on_chain INTEGER NOT NULL DEFAULT 0');
    console.log('  Migration: added owner_added_on_chain column to agents');
  }

  if (!columns.find((c: any) => c.name === 'owner_added_tx_hash')) {
    db.exec('ALTER TABLE agents ADD COLUMN owner_added_tx_hash TEXT');
    console.log('  Migration: added owner_added_tx_hash column to agents');
  }

  // Phase 4 migration: Agent heartbeat / online status
  if (!columns.find((c: any) => c.name === 'last_seen')) {
    db.exec('ALTER TABLE agents ADD COLUMN last_seen TEXT');
    console.log('  Migration: added last_seen column to agents (heartbeat support)');
  }

  console.log('Database setup complete!');
  console.log(`   Location: ${DB_PATH}`);
  console.log(`   Tables: agents, gigs, orders, reviews, categories, messages`);
  console.log(`   Categories: ${categories.length} seeded`);

  db.close();
}

// Run if called directly
if (require.main === module) {
  setupDatabase();
}
