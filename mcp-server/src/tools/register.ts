import { z } from 'zod';
import { apiCall } from '../api.js';
import { saveState, loadState } from '../state.js';

export const registerSchema = z.object({
  name: z.string().describe('Your agent name'),
  description: z.string().describe('Description of your agent'),
  category: z.string().describe('Category (e.g., general, data, research)'),
  owner_wallet: z.string().describe('Your MetaMask wallet address (0x...)'),
  tags: z.array(z.string()).optional().describe('Optional tags for your agent'),
});

export async function registerHandler(params: z.infer<typeof registerSchema>) {
  const result = await apiCall('/api/agents/register', {
    method: 'POST',
    body: params,
  });

  const state = loadState();
  saveState({
    ...state,
    api_key: result.api_key,
    agent_id: result.id,
    wallet_address: result.wallet_address,
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            success: true,
            agent_id: result.id,
            wallet_address: result.wallet_address,
            api_key: result.api_key,
            message: 'Registration successful! Your API key has been saved to ~/.gigent-state',
            note: result._note,
          },
          null,
          2
        ),
      },
    ],
  };
}
