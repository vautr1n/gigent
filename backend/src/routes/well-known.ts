import { Router } from 'express';
import { getDb } from '../db/setup';

export const wellKnownRoutes = Router();

const BASE_URL = process.env.BASE_URL || 'https://gigent.xyz';

// ─── .well-known/agent-registration.json ───
// Platform-level ERC-8004 endpoint domain verification
// Per spec: "prove control of an HTTPS endpoint-domain by publishing
//   https://{endpoint-domain}/.well-known/agent-registration.json"
//
// This serves as a directory of ALL agents on Gigent,
// making the entire marketplace discoverable by ERC-8004 crawlers
wellKnownRoutes.get('/agent-registration.json', (req, res) => {
  try {
    const db = getDb();

    const agents = db.prepare(`
      SELECT id, name, description, wallet_address, avatar_url, category, status
      FROM agents WHERE status = 'active'
      ORDER BY total_orders_completed DESC
    `).all() as any[];

    db.close();

    // Platform-level registration file
    const platformRegistration = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: 'Gigent',
      description: 'The autonomous marketplace for AI agents. Agents discover services, place orders, pay in USDC on Base, and deliver work — all without human intervention. ERC-8004 compliant.',
      image: `${BASE_URL}/logo.png`,

      services: [
        {
          name: 'web',
          endpoint: BASE_URL,
        },
        {
          name: 'gigent-api',
          endpoint: `${BASE_URL}/api`,
          version: '0.2.0',
        },
        {
          name: 'gigent-marketplace',
          endpoint: `${BASE_URL}/api/marketplace/browse`,
          version: '0.2.0',
        },
      ],

      x402Support: false,
      active: true,

      // Platform is not itself an agent, so no on-chain registration
      registrations: [],

      supportedTrust: ['reputation'],

      // ─── Directory of all registered agents ───
      // This makes the entire Gigent marketplace discoverable
      agents: agents.map((agent: any) => ({
        name: agent.name,
        description: agent.description,
        image: agent.avatar_url || `${BASE_URL}/api/agents/${agent.id}/avatar`,
        registrationFile: `${BASE_URL}/api/agents/${agent.id}/registration.json`,
        active: agent.status === 'active',
        category: agent.category,
        walletAddress: agent.wallet_address,
      })),

      // Platform metadata
      platform: {
        name: 'Gigent',
        chain: 'eip155:8453', // Base mainnet
        paymentToken: 'USDC',
        totalAgents: agents.length,
        apiDocs: `${BASE_URL}/docs.html`,
        github: 'https://github.com/gigent',
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=600'); // 10 min cache
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(platformRegistration);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
