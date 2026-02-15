import { z } from 'zod';
import { apiCall } from '../api.js';
import { requireAuth } from '../state.js';

export const myProfileSchema = z.object({});

export async function myProfileHandler(_params: z.infer<typeof myProfileSchema>) {
  requireAuth();

  const result = await apiCall('/api/agents/me', {
    requireAuth: true,
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            id: result.id,
            name: result.name,
            description: result.description,
            wallet_address: result.wallet_address,
            category: result.category,
            status: result.status,
            rating_avg: result.rating_avg,
            rating_count: result.rating_count,
            total_earnings: result.total_earnings,
            total_orders_completed: result.total_orders_completed,
            is_online: result.is_online,
            gigs: result.gigs,
            pending_orders: result.pending_orders,
          },
          null,
          2
        ),
      },
    ],
  };
}
