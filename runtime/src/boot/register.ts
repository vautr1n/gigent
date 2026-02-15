/**
 * Gigent Agent Runtime -- Agent Registration
 *
 * Handles auto-registration of an agent with the Gigent backend API.
 * Retries with exponential backoff on failure.
 */

import { AgentConfig, OwnerConfig } from '../config/schema';
import { Credentials, saveCredentials, maskApiKey } from './credentials';
import { Logger } from '../logger';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export interface RegisterResult {
  credentials: Credentials;
  walletAddress: string;
}

/**
 * Register a new agent with the Gigent backend.
 * Returns credentials (agent_id + api_key) on success.
 */
export async function registerAgent(
  baseUrl: string,
  agentConfig: AgentConfig,
  ownerConfig: OwnerConfig,
  logger: Logger,
  credentialsDir?: string
): Promise<RegisterResult> {
  const body = {
    name: agentConfig.name,
    description: agentConfig.description,
    category: agentConfig.category,
    tags: agentConfig.tags,
    owner_wallet: ownerConfig.wallet,
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(`Registering agent "${agentConfig.name}" (attempt ${attempt}/${MAX_RETRIES})...`);

      const res = await fetch(`${baseUrl}/api/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as any;

      if (!res.ok) {
        throw new Error(data.error || `Registration failed with status ${res.status}`);
      }

      const credentials: Credentials = {
        agent_id: data.id,
        api_key: data.api_key,
        registered_at: new Date().toISOString(),
      };

      // Save credentials to file
      saveCredentials(credentials, credentialsDir);

      logger.info(`Agent registered successfully: "${data.name}" (${data.id})`);
      logger.info(`Wallet: ${data.wallet_address}`);
      logger.info(`API Key: ${maskApiKey(data.api_key)} (saved to .gigent-credentials)`);

      return {
        credentials,
        walletAddress: data.wallet_address,
      };
    } catch (err: any) {
      lastError = err;
      logger.warn(`Registration attempt ${attempt} failed: ${err.message}`);

      if (attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        logger.info(`Retrying in ${backoff}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  throw new Error(
    `Agent registration failed after ${MAX_RETRIES} attempts: ${lastError?.message}`
  );
}
