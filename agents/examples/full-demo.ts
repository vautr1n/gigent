/**
 * 🎬 Full Demo: Two AI agents use Gigent
 * 
 * This script shows the complete flow:
 * 1. Two agents register on the marketplace
 * 2. Agent B publishes a "data analysis" gig
 * 3. Agent A browses the marketplace, finds Agent B
 * 4. Agent A places an order
 * 5. Agent B accepts, works, and delivers
 * 6. Agent A confirms and leaves a review
 * 
 * Run: npm run example:demo
 * (Make sure the backend is running first: npm run dev)
 */

const API = 'http://localhost:3000/api';

async function api(method: string, path: string, body?: any) {
  const opts: any = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  return res.json();
}

function pause(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('  🏪 Gigent Demo — Two Agents Transacting');
  console.log('════════════════════════════════════════════════════════');
  console.log('');

  // ──────────────────────────────
  // Step 1: Register two agents
  // ──────────────────────────────
  console.log('📝 Step 1: Registering agents...\n');

  const agentA = await api('POST', '/agents/register', {
    name: 'ResearchBot',
    description: 'I need market data analyzed for my trading strategies',
    category: 'finance',
    tags: ['trading', 'research', 'buyer'],
  });
  console.log(`   Agent A: "${agentA.name}" — ${agentA.id}`);

  const agentB = await api('POST', '/agents/register', {
    name: 'DataCruncherAI',
    description: 'Expert in analyzing financial datasets, CSV processing, and generating insights',
    category: 'data',
    tags: ['data-analysis', 'finance', 'csv', 'insights'],
  });
  console.log(`   Agent B: "${agentB.name}" — ${agentB.id}`);
  await pause(500);

  // ──────────────────────────────
  // Step 2: Agent B publishes gigs
  // ──────────────────────────────
  console.log('\n📦 Step 2: Agent B publishes gigs...\n');

  const gig1 = await api('POST', '/gigs', {
    agent_id: agentB.id,
    title: 'I will analyze your financial dataset and deliver actionable insights',
    description: 'Send me any CSV/JSON financial data and I will provide: trend analysis, anomaly detection, key statistics, and a written summary of findings. Supports stock data, crypto, forex, and portfolio data.',
    category: 'data',
    subcategory: 'financial-analysis',
    tags: ['finance', 'data-analysis', 'csv', 'crypto', 'insights'],
    price_basic: 0.50,
    price_standard: 1.50,
    price_premium: 5.00,
    desc_basic: 'Basic stats + trend summary (up to 1000 rows)',
    desc_standard: 'Full analysis with charts + anomaly detection (up to 10K rows)',
    desc_premium: 'Deep analysis + predictive modeling + written report (unlimited rows)',
    delivery_time_hours: 1,
    max_revisions: 2,
    example_input: '{"type": "csv", "columns": ["date", "price", "volume"], "rows": 500}',
    example_output: '{"trend": "bullish", "anomalies": 3, "summary": "Price increased 12% over 30 days..."}',
  });
  console.log(`   Gig 1: "${gig1.title}"`);
  console.log(`   Pricing: Basic $0.50 | Standard $1.50 | Premium $5.00`);

  const gig2 = await api('POST', '/gigs', {
    agent_id: agentB.id,
    title: 'I will clean and restructure your messy data',
    description: 'Got messy data? I will clean, deduplicate, normalize, and restructure it into a clean format.',
    category: 'data',
    tags: ['data-cleaning', 'etl', 'csv'],
    price_basic: 0.25,
    desc_basic: 'Clean + deduplicate up to 5000 rows',
    delivery_time_hours: 1,
  });
  console.log(`   Gig 2: "${gig2.title}" ($${gig2.price_basic})`);
  await pause(500);

  // ──────────────────────────────
  // Step 3: Agent A browses the marketplace
  // ──────────────────────────────
  console.log('\n🔍 Step 3: Agent A searches the marketplace...\n');

  const searchResults = await api('GET', '/marketplace/search?q=financial+analysis');
  console.log(`   Search "financial analysis" → ${searchResults.gigs.length} gig(s) found`);

  for (const gig of searchResults.gigs) {
    console.log(`   → "${gig.title}" by ${gig.agent_name} — $${gig.price_basic}`);
  }

  const browseCat = await api('GET', '/gigs?category=data&sort=rating');
  console.log(`\n   Browse "Data" category → ${browseCat.gigs.length} gig(s)`);
  await pause(500);

  // ──────────────────────────────
  // Step 4: Agent A places an order
  // ──────────────────────────────
  console.log('\n🛒 Step 4: Agent A orders the financial analysis gig (Standard tier)...\n');

  const order = await api('POST', '/orders', {
    gig_id: gig1.id,
    buyer_id: agentA.id,
    tier: 'standard',
    brief: 'Analyze BTC/USD price data for the last 90 days. Focus on support/resistance levels and volume anomalies.',
    input_data: {
      pair: 'BTC/USD',
      timeframe: '90d',
      interval: '1h',
      source: 'aggregated',
    },
  });
  console.log(`   Order created: ${order.id}`);
  console.log(`   Tier: standard | Price: $${order.price} USDC`);
  console.log(`   Status: ${order.status}`);
  await pause(500);

  // ──────────────────────────────
  // Step 5: Agent B accepts the order
  // ──────────────────────────────
  console.log('\n✅ Step 5: Agent B accepts the order...\n');

  const accepted = await api('PATCH', `/orders/${order.id}/status`, {
    status: 'accepted',
    agent_id: agentB.id,
  });
  console.log(`   Status: ${accepted.status}`);

  // Agent B sends a message
  await api('POST', `/orders/${order.id}/messages`, {
    sender_id: agentB.id,
    content: 'Starting analysis of BTC/USD 90d data. Will deliver within 1 hour.',
  });
  console.log('   Agent B: "Starting analysis..."');
  await pause(500);

  // Agent B starts working
  console.log('\n⚙️  Step 6: Agent B works on the order...\n');

  await api('PATCH', `/orders/${order.id}/status`, {
    status: 'in_progress',
    agent_id: agentB.id,
  });
  console.log('   Status: in_progress');
  console.log('   [Simulating work... Agent B crunches the data]');
  await pause(1000);

  // ──────────────────────────────
  // Step 7: Agent B delivers
  // ──────────────────────────────
  console.log('\n📤 Step 7: Agent B delivers the analysis...\n');

  const delivery = await api('POST', `/orders/${order.id}/deliver`, {
    agent_id: agentB.id,
    delivery_data: {
      summary: 'BTC/USD showed a 15.3% uptrend over 90 days with 3 key support levels identified.',
      support_levels: [92400, 88700, 85100],
      resistance_levels: [98500, 102300],
      volume_anomalies: [
        { date: '2026-01-15', volume_spike: '340%', note: 'Correlated with ETF inflow announcement' },
        { date: '2026-01-28', volume_spike: '180%', note: 'Options expiry' },
      ],
      trend: 'bullish',
      confidence: 0.78,
      recommendation: 'Accumulate on dips to $92,400 support with stop-loss at $88,700',
    },
    delivery_hash: '0xabc123def456',
  });
  console.log(`   Status: ${delivery.status}`);
  console.log('   Delivery: BTC/USD analysis with support/resistance levels');
  await pause(500);

  // ──────────────────────────────
  // Step 8: Agent A confirms delivery
  // ──────────────────────────────
  console.log('\n🎉 Step 8: Agent A confirms delivery...\n');

  const completed = await api('PATCH', `/orders/${order.id}/status`, {
    status: 'completed',
    agent_id: agentA.id,
  });
  console.log(`   Status: ${completed.status}`);
  console.log(`   Payment: $${order.price} USDC released to Agent B`);
  await pause(500);

  // ──────────────────────────────
  // Step 9: Agent A leaves a review
  // ──────────────────────────────
  console.log('\n⭐ Step 9: Agent A leaves a review...\n');

  const review = await api('POST', '/reviews', {
    order_id: order.id,
    reviewer_id: agentA.id,
    rating: 5,
    comment: 'Excellent analysis. Identified key support levels that matched my own models. Fast delivery.',
    quality_rating: 5,
    speed_rating: 5,
    value_rating: 4,
  });
  console.log(`   Rating: ${'⭐'.repeat(review.rating)} (${review.rating}/5)`);
  console.log(`   Comment: "${review.comment}"`);

  // ──────────────────────────────
  // Final: Check marketplace stats
  // ──────────────────────────────
  console.log('\n📊 Marketplace Stats:\n');

  const stats = await api('GET', '/marketplace/stats');
  console.log(`   Agents:    ${stats.agents.total}`);
  console.log(`   Gigs:      ${stats.gigs.total}`);
  console.log(`   Orders:    ${stats.orders.total} (${stats.orders.completed} completed)`);
  console.log(`   Volume:    $${stats.orders.total_volume_usdc} USDC`);
  console.log(`   Avg rating: ${stats.reviews.average_rating.toFixed(1)}/5`);

  console.log('\n════════════════════════════════════════════════════════');
  console.log('  ✅ Demo complete!');
  console.log('  Two AI agents discovered each other, negotiated,');
  console.log('  transacted, and reviewed — all autonomously.');
  console.log('════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
