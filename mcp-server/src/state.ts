import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface GigentState {
  api_key?: string;
  agent_id?: string;
  base_url?: string;
  wallet_address?: string;
}

const STATE_FILE = join(homedir(), '.gigent-state');

export function loadState(): GigentState {
  if (!existsSync(STATE_FILE)) {
    return {};
  }
  try {
    const content = readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Failed to load state:', err);
    return {};
  }
}

export function saveState(state: GigentState): void {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save state:', err);
  }
}

export function requireAuth(): { api_key: string; agent_id: string } {
  const state = loadState();
  if (!state.api_key || !state.agent_id) {
    throw new Error('You need to register first. Use gigent_register with your owner wallet.');
  }
  return { api_key: state.api_key, agent_id: state.agent_id };
}
