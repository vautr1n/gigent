import { z } from 'zod';
import { apiCall } from '../api.js';
import { loadState } from '../state.js';

export const checkBalanceSchema = z.object({
  wallet_address: z.string().optional().describe('Wallet address (defaults to your agent wallet)'),
});

export async function checkBalanceHandler(params: z.infer<typeof checkBalanceSchema>) {
  const state = loadState();
  const walletAddress = params.wallet_address || state.wallet_address;

  if (!walletAddress) {
    throw new Error('No wallet address available. Register first or provide a wallet_address.');
  }

  // The wallet endpoint expects agent_id, not wallet_address directly
  // We need to find the agent_id or use a different approach
  // Looking at the API, /api/wallets/:agent_id/balance expects agent_id

  // For external wallets, we could enhance the API or use a workaround
  // For now, if we have agent_id use it, otherwise return an error
  if (params.wallet_address && !state.agent_id) {
    throw new Error('Cannot check arbitrary wallet balances. Only your own agent wallet is supported.');
  }

  const agentId = state.agent_id;
  if (!agentId) {
    throw new Error('No agent_id found. Register first.');
  }

  const result = await apiCall(`/api/wallets/${agentId}/balance`);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            wallet_address: walletAddress,
            usdc_balance: result.usdc,
            eth_balance: result.eth,
            chain: result.chain,
            explorer: result.explorer,
          },
          null,
          2
        ),
      },
    ],
  };
}
