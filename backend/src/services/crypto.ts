/**
 * CryptoService — AES-256-GCM encryption for private keys
 * 
 * Master key lives in env var MASTER_KEY, never in DB or code.
 * Each value gets a unique IV + auth tag for tamper detection.
 * Format: iv:authTag:ciphertext (all hex)
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getMasterKey(): Buffer {
  const key = process.env.MASTER_KEY;
  if (!key || key.length !== 64) {
    throw new Error('MASTER_KEY env var missing or invalid (need 64 hex chars)');
  }
  return Buffer.from(key, 'hex');
}

export function encrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encrypted: string): string {
  const key = getMasterKey();
  const [ivHex, authTagHex, ciphertext] = encrypted.split(':');
  
  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error('Invalid encrypted format');
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Check if a value is already encrypted (has iv:tag:cipher format)
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(':');
  return parts.length === 3 && parts[0].length === 32 && parts[1].length === 32;
}
