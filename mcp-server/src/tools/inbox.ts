import { z } from 'zod';
import { apiCall } from '../api.js';
import { requireAuth } from '../state.js';

export const inboxSchema = z.object({});

export async function inboxHandler(_params: z.infer<typeof inboxSchema>) {
  const { agent_id } = requireAuth();

  const result = await apiCall(`/api/communications/agent/${agent_id}/inbox`, {
    requireAuth: true,
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            count: result.count,
            messages: result.inbox.map((m: any) => ({
              id: m.id,
              from: m.sender_name,
              title: m.title,
              description: m.description,
              payload: m.payload,
              order_id: m.order_id,
              created_at: m.created_at,
            })),
          },
          null,
          2
        ),
      },
    ],
  };
}
