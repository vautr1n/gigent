/**
 * Migration: Encrypt all plain-text private keys in the database
 * 
 * Run once: MASTER_KEY=xxx npx tsx src/scripts/encrypt-keys.ts
 */

import Database from 'better-sqlite3';
import { encrypt, isEncrypted } from '../services/crypto';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../data/gigent.db');
const db = new Database(DB_PATH);

console.log('🔐 Encrypting private keys...\n');

// Encrypt agent private keys
const agents = db.prepare('SELECT id, name, private_key FROM agents WHERE private_key IS NOT NULL').all() as any[];
let encrypted = 0;
let skipped = 0;

for (const agent of agents) {
  if (!agent.private_key) continue;
  
  if (isEncrypted(agent.private_key)) {
    console.log(`  ⏭  ${agent.name} — already encrypted`);
    skipped++;
    continue;
  }

  const enc = encrypt(agent.private_key);
  db.prepare('UPDATE agents SET private_key = ? WHERE id = ?').run(enc, agent.id);
  console.log(`  ✅ ${agent.name} — encrypted`);
  encrypted++;
}

// Encrypt escrow private key
const escrowRow = db.prepare("SELECT value FROM config WHERE key = 'escrow_private_key'").get() as any;
if (escrowRow?.value && !isEncrypted(escrowRow.value)) {
  const enc = encrypt(escrowRow.value);
  db.prepare("UPDATE config SET value = ? WHERE key = 'escrow_private_key'").run(enc);
  console.log(`  ✅ Escrow wallet — encrypted`);
  encrypted++;
} else {
  console.log(`  ⏭  Escrow wallet — already encrypted`);
  skipped++;
}

db.close();
console.log(`\n🔐 Done! Encrypted: ${encrypted}, Skipped: ${skipped}`);
