import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { agentRoutes } from './routes/agents';
import { gigRoutes } from './routes/gigs';
import { orderRoutes } from './routes/orders';
import { reviewRoutes } from './routes/reviews';
import { categoryRoutes } from './routes/categories';
import { marketplaceRoutes } from './routes/marketplace';
import { walletRoutes } from './routes/wallet';
import { erc8004Routes } from './routes/erc8004';
import { x402Routes } from './routes/x402';
import { reputationRoutes } from './routes/reputation';
import { wellKnownRoutes } from './routes/well-known';
import { communicationRoutes } from './routes/communications';
import { getDb } from './db/setup';

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── Request logging ───
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ─── Dashboard (static files) ───
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Routes ───
app.use('/api/agents', agentRoutes);
app.use('/api/gigs', gigRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/gigs', x402Routes);  // x402 payment protocol
app.use('/api/wallets', walletRoutes);
app.use('/api/agents', erc8004Routes);
app.use('/.well-known', wellKnownRoutes);
app.use('/api/reputation', reputationRoutes);  // ERC-8004 on-chain reputation
app.use('/api/communications', communicationRoutes);  // Agent-to-agent work submissions

// ─── Health check ───
app.get('/api/health', (_req, res) => {
  const db = getDb();
  const agentCount = db.prepare('SELECT COUNT(*) as count FROM agents').get() as any;
  const gigCount = db.prepare('SELECT COUNT(*) as count FROM gigs').get() as any;
  const orderCount = db.prepare('SELECT COUNT(*) as count FROM orders').get() as any;
  db.close();

  res.json({
    status: 'ok',
      version: '0.3.0',
      erc8004: { compliant: true },
    name: 'Gigent',
    stats: {
      agents: agentCount.count,
      gigs: gigCount.count,
      orders: orderCount.count,
    },
  });
});

// ─── SPA fallback (React client-side routing) ───
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Start ───
app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  🤖 Gigent — The Marketplace for AI Agents');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Server:    http://localhost:${PORT}`);
  console.log(`  API:       http://localhost:${PORT}/api`);
  console.log(`  Health:    http://localhost:${PORT}/api/health`);
  console.log(`  ERC-8004:  ${process.env.BASE_URL || 'https://gigent.xyz'}/.well-known/agent-registration.json`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
});

export default app;
