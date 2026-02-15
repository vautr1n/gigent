import { Router } from 'express';
import { getDb } from '../db/setup';

// ERC-8004 on-chain agent ID mapping (Base mainnet)
const erc8004Mapping = require('../erc8004-mapping.json');

export const erc8004Routes = Router();

const BASE_URL = process.env.BASE_URL || 'https://gigent.xyz';

// ─── ERC-8004 Agent Registration File ───
// Serves a spec-compliant registration file for any agent
// Spec: https://eips.ethereum.org/EIPS/eip-8004#registration-v1
erc8004Routes.get('/:id/registration.json', (req, res) => {
  try {
    const db = getDb();

    const agent = db.prepare(`
      SELECT id, name, description, wallet_address, avatar_url, category, tags, 
             status, rating_avg, rating_count, total_orders_completed, total_earnings
      FROM agents WHERE id = ?
    `).get(req.params.id) as any;

    if (!agent) {
      db.close();
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Get agent's active gigs for the description
    const gigs = db.prepare(`
      SELECT id, title, description, category, price_basic, price_standard, price_premium,
             desc_basic, delivery_time_hours
      FROM gigs WHERE agent_id = ? AND status = 'active'
    `).all(req.params.id) as any[];

    db.close();

    // Build services list
    const services: any[] = [
      {
        name: 'web',
        endpoint: `${BASE_URL}`,
      },
      {
        name: 'gigent-api',
        endpoint: `${BASE_URL}/api/agents/${agent.id}`,
        version: '0.3.0',
      },
    ];

    // Add marketplace endpoint if agent has gigs
    if (gigs.length > 0) {
      services.push({
        name: 'gigent-marketplace',
        endpoint: `${BASE_URL}/api/gigs?agent_id=${agent.id}`,
        version: '0.3.0',
      });
    }

    // Build rich description including gigs info
    let fullDescription = agent.description || '';
    if (gigs.length > 0) {
      fullDescription += '\n\nAvailable services on Gigent:\n';
      gigs.forEach((gig: any) => {
        fullDescription += `- ${gig.title} (from $${gig.price_basic} USDC)`;
        if (gig.delivery_time_hours) fullDescription += ` — ${gig.delivery_time_hours}h delivery`;
        fullDescription += '\n';
      });
    }

    // Build pricing info for description
    const priceRange = gigs.length > 0
      ? `Pricing: $${Math.min(...gigs.map((g: any) => g.price_basic))} – $${Math.max(...gigs.map((g: any) => g.price_premium || g.price_basic))} USDC`
      : '';

    // ERC-8004 compliant registration file
    const registrationFile = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: agent.name,
      description: fullDescription.trim() + (priceRange ? `\n\n${priceRange}` : ''),
      image: agent.avatar_url || `${BASE_URL}/api/agents/${agent.id}/avatar`,

      services,

      // Payment support
      x402Support: true, // Phase 2: will be true when x402 is integrated

      // Agent status
      active: agent.status === 'active',

      // On-chain registrations (empty until Phase 2: minting on-chain)
      // Will be populated with agentId + registry address once deployed on Base/Ethereum
      registrations: (() => {
        const agentId = erc8004Mapping.agents[agent.name];
        if (agentId) {
          return [{
            agentRegistry: `${erc8004Mapping.chain}:${erc8004Mapping.identityRegistry}`,
            agentId: agentId
          }];
        }
        return [];
      })(),

      // Trust model — Gigent provides reputation via reviews
      supportedTrust: ['reputation'],

      // ─── Gigent-specific extensions (non-spec, but useful for discovery) ───
      gigent: {
        agentId: agent.id,
        walletAddress: agent.wallet_address,
        category: agent.category,
        tags: JSON.parse(agent.tags || '[]'),
        stats: {
          ratingAvg: agent.rating_avg,
          ratingCount: agent.rating_count,
          totalOrdersCompleted: agent.total_orders_completed,
          totalEarnings: agent.total_earnings,
        },
        gigs: gigs.map((g: any) => ({
          id: g.id,
          title: g.title,
          category: g.category,
          pricing: {
            basic: g.price_basic,
            standard: g.price_standard,
            premium: g.price_premium,
          },
          orderEndpoint: `${BASE_URL}/api/orders`,
        })),
        reviewsEndpoint: `${BASE_URL}/api/agents/${agent.id}`,
        paymentChain: 'eip155:8453', // Base mainnet
        paymentToken: 'USDC',
        paymentContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
      },
    };

    // Set proper content type and cache headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(registrationFile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
