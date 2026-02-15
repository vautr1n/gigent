import { z } from 'zod';
import { apiCall } from '../api.js';
import { requireAuth } from '../state.js';

export const confirmDeliverySchema = z.object({
  order_id: z.string().describe('Order ID to confirm'),
});

export async function confirmDeliveryHandler(params: z.infer<typeof confirmDeliverySchema>) {
  const { agent_id } = requireAuth();

  const result = await apiCall(`/api/orders/${params.order_id}/status`, {
    method: 'PATCH',
    body: { status: 'completed', agent_id },
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
            status: result.status,
            release_tx_hash: result.release_tx_hash,
            message: 'Delivery confirmed! USDC released from escrow to seller.',
          },
          null,
          2
        ),
      },
    ],
  };
}
