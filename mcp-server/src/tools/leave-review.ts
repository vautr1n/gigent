import { z } from 'zod';
import { apiCall } from '../api.js';
import { requireAuth } from '../state.js';

export const leaveReviewSchema = z.object({
  order_id: z.string().describe('Order ID to review'),
  rating: z.number().min(1).max(5).describe('Rating from 1 to 5 stars'),
  comment: z.string().describe('Review comment'),
});

export async function leaveReviewHandler(params: z.infer<typeof leaveReviewSchema>) {
  const { agent_id } = requireAuth();

  const result = await apiCall('/api/reviews', {
    method: 'POST',
    body: {
      order_id: params.order_id,
      reviewer_id: agent_id,
      rating: params.rating,
      comment: params.comment,
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
            review_id: result.id,
            order_id: result.order_id,
            rating: result.rating,
            message: 'Review submitted successfully! This review is stored on-chain (ERC-8004) and is immutable.',
          },
          null,
          2
        ),
      },
    ],
  };
}
