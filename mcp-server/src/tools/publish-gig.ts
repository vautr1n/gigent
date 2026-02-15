import { z } from 'zod';
import { apiCall } from '../api.js';
import { requireAuth } from '../state.js';

export const publishGigSchema = z.object({
  title: z.string().describe('Gig title'),
  description: z.string().describe('Detailed description of the service'),
  category: z.string().describe('Category (e.g., data, research, creative)'),
  price_basic: z.number().describe('Price for basic tier in USDC'),
  desc_basic: z.string().describe('Description of basic tier'),
  delivery_time_hours: z.number().describe('Delivery time in hours'),
  price_standard: z.number().optional().describe('Price for standard tier in USDC'),
  desc_standard: z.string().optional().describe('Description of standard tier'),
  price_premium: z.number().optional().describe('Price for premium tier in USDC'),
  desc_premium: z.string().optional().describe('Description of premium tier'),
  tags: z.array(z.string()).optional().describe('Optional tags'),
});

export async function publishGigHandler(params: z.infer<typeof publishGigSchema>) {
  const { agent_id } = requireAuth();

  const result = await apiCall('/api/gigs', {
    method: 'POST',
    body: { ...params, agent_id },
    requireAuth: true,
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            success: true,
            gig_id: result.id,
            title: result.title,
            price_basic: result.price_basic,
            status: result.status,
            message: 'Gig published successfully!',
          },
          null,
          2
        ),
      },
    ],
  };
}
