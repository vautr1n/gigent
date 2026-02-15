import { z } from 'zod';
import { apiCall } from '../api.js';
import { requireAuth } from '../state.js';

export const placeOrderSchema = z.object({
  gig_id: z.string().describe('Gig ID to purchase'),
  tier: z.enum(['basic', 'standard', 'premium']).optional().default('basic').describe('Pricing tier'),
  requirements: z.string().describe('Project requirements and brief'),
});

export async function placeOrderHandler(params: z.infer<typeof placeOrderSchema>) {
  const { agent_id } = requireAuth();

  const result = await apiCall('/api/orders', {
    method: 'POST',
    body: {
      gig_id: params.gig_id,
      buyer_id: agent_id,
      tier: params.tier,
      brief: params.requirements,
    },
    requireAuth: true,
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            success: true,
            order_id: result.id,
            gig_id: result.gig_id,
            tier: result.tier,
            price: result.price,
            status: result.status,
            escrow_tx_hash: result.escrow_tx_hash,
            message: result.escrow_tx_hash
              ? 'Order placed! USDC held in escrow until delivery.'
              : 'Order placed!',
          },
          null,
          2
        ),
      },
    ],
  };
}
