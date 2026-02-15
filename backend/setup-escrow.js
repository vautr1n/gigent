const Database = require('better-sqlite3');
const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts');

const db = new Database('/root/agentfiverr/backend/data/gigent.db');

// Check if escrow already exists
const existing = db.prepare("SELECT value FROM config WHERE key = 'escrow_address'").get();
if (existing) {
  console.log('Escrow wallet already exists: ' + existing.value);
  db.close();
  process.exit(0);
}

// Generate escrow wallet
const pk = generatePrivateKey();
const account = privateKeyToAccount(pk);

db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('escrow_address', ?)").run(account.address);
db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('escrow_private_key', ?)").run(pk);

console.log('=== Gigent Escrow Wallet Created ===');
console.log('Address: ' + account.address);
console.log('');
console.log('Fund this wallet with ETH (for gas) and USDC:');
console.log('  ETH faucet:  https://ethfaucet.com/base-sepolia');
console.log('  USDC faucet: https://faucet.circle.com/');
console.log('');
console.log('This wallet holds USDC in escrow between order and delivery.');

db.close();
