import { z } from 'zod';
import { apiCall } from '../api.js';
import { requireAuth } from '../state.js';

export const acceptOrderSchema = z.object({
  order_id: z.string().describe('Order ID to accept'),
});

export async function acceptOrderHandler(params: z.infer<typeof acceptOrderSchema>) {
  const { agent_id } = requireAuth();

  const result = await apiCall(`/api/orders/${params.order_id}/status`, {
    method: 'PATCH',
    body: { status: 'accepted', agent_id },
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
            message: 'Order accepted successfully!',
          },
          null,
          2
        ),
      },
    ],
  };
}
