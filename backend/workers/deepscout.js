const https = require('https');
const { execSync } = require('child_process');

const GIGENT_URL = 'https://gigent.xyz/api';
const DEEPSCOUT_API_KEY = 'sk_f815805bfae99768e96852dceaeadc371b2b4ed67cac7ed5';
const DEEPSCOUT_ID = 'cbbc3fbc-081a-4757-9d8c-9d77af32f65e';
const POLL_INTERVAL = 15000;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(GIGENT_URL + path);
    const options = {
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search, method,
      headers: { 'Content-Type': 'application/json', 'X-API-Key': DEEPSCOUT_API_KEY }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function callClaude(prompt) {
  try {
    const escaped = prompt.replace(/'/g, "'\\''");
    const result = execSync(`cd /tmp && echo '${escaped}' | claude --print 2>/dev/null`, {
      timeout: 120000, maxBuffer: 1024 * 1024, encoding: 'utf-8'
    });
    return result.trim();
  } catch (err) {
    throw new Error('Claude error: ' + (err.stdout || err.message));
  }
}

function buildPrompt(order) {
  return `Write a research report on the following topic. Be thorough, specific, and provide actionable insights. Use clear sections.

Topic: ${order.gig_title || 'General research'}
Details: ${order.brief || 'Provide a comprehensive overview.'}

End with "— DeepScout"`;
}

async function processOrder(order) {
  console.log(`\n🔍 Processing order ${order.id}`);
  console.log(`   Buyer: ${order.buyer_name} | Gig: ${order.gig_title} | $${order.price}`);
  try {
    console.log('   → Accepting...');
    await request('PATCH', `/orders/${order.id}/status`, { status: 'accepted' });
    console.log('   → Working...');
    await request('PATCH', `/orders/${order.id}/status`, { status: 'in_progress' });
    console.log('   → Calling Claude...');
    const result = callClaude(buildPrompt(order));
    console.log(`   → Done (${result.length} chars). Delivering...`);
    await request('POST', `/orders/${order.id}/deliver`, {
      agent_id: DEEPSCOUT_ID,
      delivery_data: result
    });
    console.log('   ✅ Delivered!');
  } catch (err) {
    console.error(`   ❌ ${err.message}`);
  }
}

async function poll() {
  try {
    const data = await request('GET', '/agents/me');
    const orders = (data.pending_orders || []).filter(o => o.status === 'pending' || o.status === 'paid' || o.status === 'revision_requested');
    if (orders.length > 0) {
      console.log(`\n📬 ${orders.length} pending order(s)`);
      for (const o of orders) await processOrder(o);
    }
  } catch (err) { console.error('Poll error:', err.message); }
}

console.log('🤖 DeepScout worker started');
poll();
setInterval(poll, POLL_INTERVAL);
