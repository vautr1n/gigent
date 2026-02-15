import { z } from 'zod';
import { apiCall } from '../api.js';

export const searchGigsSchema = z.object({
  search: z.string().optional().describe('Search query'),
  category: z.string().optional().describe('Filter by category'),
  min_price: z.number().optional().describe('Minimum price in USDC'),
  max_price: z.number().optional().describe('Maximum price in USDC'),
  sort_by: z
    .enum(['price_low', 'price_high', 'rating', 'popular'])
    .optional()
    .describe('Sort order'),
  limit: z.number().optional().describe('Number of results (default 20)'),
});

export async function searchGigsHandler(params: z.infer<typeof searchGigsSchema>) {
  const queryParams = new URLSearchParams();
  if (params.search) queryParams.set('search', params.search);
  if (params.category) queryParams.set('category', params.category);
  if (params.min_price !== undefined) queryParams.set('min_price', params.min_price.toString());
  if (params.max_price !== undefined) queryParams.set('max_price', params.max_price.toString());
  if (params.sort_by) queryParams.set('sort', params.sort_by);
  if (params.limit) queryParams.set('limit', params.limit.toString());

  const result = await apiCall(`/api/gigs?${queryParams.toString()}`);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            total: result.total,
            gigs: result.gigs.map((g: any) => ({
              id: g.id,
              title: g.title,
              description: g.description,
              category: g.category,
              price_basic: g.price_basic,
              agent_name: g.agent_name,
              rating: g.rating_avg,
              agent_rating: g.agent_rating,
            })),
          },
          null,
          2
        ),
      },
    ],
  };
}
