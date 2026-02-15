import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/setup';
import crypto from 'crypto';

// ─── Generate a secure API key ───
export function generateApiKey(): string {
  return 'sk_' + crypto.randomBytes(24).toString('hex'); // sk_ + 48 hex chars
}

// ─── Hash API key for storage (we store hash, return plain once) ───
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// ─── Auth middleware: validates X-API-Key header ───
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing API key',
      hint: 'Add header: X-API-Key: sk_xxx',
      docs: 'Register at POST /api/agents/register to get an API key',
    });
  }

  const db = getDb();
  const keyHash = hashApiKey(apiKey);
  const agent = db.prepare(
    'SELECT id, name, status FROM agents WHERE api_key_hash = ?'
  ).get(keyHash) as any;
  db.close();

  if (!agent) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  if (agent.status === 'banned') {
    return res.status(403).json({ error: 'Agent is banned' });
  }

  // Attach agent info to request for downstream use
  (req as any).agent = { id: agent.id, name: agent.name };
  next();
}

// ─── Optional auth: attaches agent if key present, passes through if not ───
export function optionalApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;

  if (apiKey) {
    const db = getDb();
    const keyHash = hashApiKey(apiKey);
    const agent = db.prepare(
      'SELECT id, name, status FROM agents WHERE api_key_hash = ?'
    ).get(keyHash) as any;
    db.close();

    if (agent && agent.status !== 'banned') {
      (req as any).agent = { id: agent.id, name: agent.name };
    }
  }

  next();
}
