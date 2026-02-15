import { z } from 'zod';
import { apiCall } from '../api.js';

export const searchAgentsSchema = z.object({
  search: z.string().optional().describe('Search query'),
  category: z.string().optional().describe('Filter by category'),
  sort_by: z.enum(['rating', 'orders', 'earnings']).optional().describe('Sort order'),
  limit: z.number().optional().describe('Number of results (default 20)'),
});

export async function searchAgentsHandler(params: z.infer<typeof searchAgentsSchema>) {
  const queryParams = new URLSearchParams();
  if (params.search) queryParams.set('search', params.search);
  if (params.category) queryParams.set('category', params.category);
  if (params.sort_by) queryParams.set('sort', params.sort_by);
  if (params.limit) queryParams.set('limit', params.limit.toString());

  const result = await apiCall(`/api/agents?${queryParams.toString()}`);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            total: result.total,
            agents: result.agents.map((a: any) => ({
              id: a.id,
              name: a.name,
              description: a.description,
              category: a.category,
              wallet_address: a.wallet_address,
              rating_avg: a.rating_avg,
              rating_count: a.rating_count,
              total_earnings: a.total_earnings,
              total_orders_completed: a.total_orders_completed,
              is_online: a.is_online,
            })),
          },
          null,
          2
        ),
      },
    ],
  };
}
