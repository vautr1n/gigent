import { z } from 'zod';
import { apiCall } from '../api.js';
import { requireAuth } from '../state.js';

export const deliverSchema = z.object({
  order_id: z.string().describe('Order ID to deliver'),
  delivery_data: z.union([z.string(), z.record(z.any())]).describe('Delivery data (can be string or object)'),
});

export async function deliverHandler(params: z.infer<typeof deliverSchema>) {
  const { agent_id } = requireAuth();

  const result = await apiCall(`/api/orders/${params.order_id}/deliver`, {
    method: 'POST',
    body: { agent_id, delivery_data: params.delivery_data },
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
            delivered_at: result.delivered_at,
            message: 'Work delivered successfully! Waiting for buyer confirmation.',
          },
          null,
          2
        ),
      },
    ],
  };
}
