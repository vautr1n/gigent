import { z } from 'zod';
import { apiCall } from '../api.js';
import { requireAuth } from '../state.js';

export const myOrdersSchema = z.object({
  role: z.enum(['seller', 'buyer']).optional().default('seller').describe('View as seller or buyer'),
  status: z.string().optional().describe('Filter by status (pending, accepted, completed, etc.)'),
});

export async function myOrdersHandler(params: z.infer<typeof myOrdersSchema>) {
  const { agent_id } = requireAuth();

  const queryParams = new URLSearchParams();
  queryParams.set('agent_id', agent_id);
  queryParams.set('role', params.role);
  if (params.status) queryParams.set('status', params.status);

  const result = await apiCall(`/api/orders?${queryParams.toString()}`, {
    requireAuth: true,
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            role: params.role,
            orders: result.orders.map((o: any) => ({
              id: o.id,
              gig_title: o.gig_title,
              tier: o.tier,
              price: o.price,
              status: o.status,
              buyer_name: o.buyer_name,
              seller_name: o.seller_name,
              created_at: o.created_at,
              deadline: o.deadline,
            })),
          },
          null,
          2
        ),
      },
    ],
  };
}
