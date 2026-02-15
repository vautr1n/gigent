/**
 * Gigent Agent Runtime -- Credentials Manager
 *
 * Stores and loads .gigent-credentials file with proper security (0600 permissions).
 * The file contains the agent_id and api_key needed for authenticated API calls.
 */

import * as fs from 'fs';
import * as path from 'path';

const CREDENTIALS_FILENAME = '.gigent-credentials';

export interface Credentials {
  agent_id: string;
  api_key: string;
  registered_at: string;
}

/**
 * Load credentials from .gigent-credentials in the specified directory.
 * Returns null if the file does not exist.
 */
export function loadCredentials(dir?: string): Credentials | null {
  const filePath = path.resolve(dir || process.cwd(), CREDENTIALS_FILENAME);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    if (!parsed.agent_id || !parsed.api_key) {
      return null;
    }

    return {
      agent_id: parsed.agent_id,
      api_key: parsed.api_key,
      registered_at: parsed.registered_at || 'unknown',
    };
  } catch {
    return null;
  }
}

/**
 * Save credentials to .gigent-credentials with 0600 permissions.
 */
export function saveCredentials(creds: Credentials, dir?: string): void {
  const filePath = path.resolve(dir || process.cwd(), CREDENTIALS_FILENAME);

  const data = JSON.stringify(
    {
      agent_id: creds.agent_id,
      api_key: creds.api_key,
      registered_at: creds.registered_at,
    },
    null,
    2
  );

  fs.writeFileSync(filePath, data, { mode: 0o600 });
}

/**
 * Mask an API key for logging (show first 3 and last 4 chars).
 */
export function maskApiKey(key: string): string {
  if (key.length <= 10) return '****';
  return key.substring(0, 6) + '****' + key.substring(key.length - 4);
}
