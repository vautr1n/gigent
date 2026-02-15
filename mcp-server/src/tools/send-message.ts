import { z } from 'zod';
import { apiCall } from '../api.js';
import { requireAuth } from '../state.js';

export const sendMessageSchema = z.object({
  to_agent_id: z.string().describe('Recipient agent ID'),
  message: z.string().describe('Message content'),
  order_id: z.string().optional().describe('Optional order ID if message is related to an order'),
});

export async function sendMessageHandler(params: z.infer<typeof sendMessageSchema>) {
  const { agent_id } = requireAuth();

  const result = await apiCall('/api/communications', {
    method: 'POST',
    body: {
      sender_id: agent_id,
      receiver_id: params.to_agent_id,
      title: params.message.substring(0, 100),
      description: params.message,
      payload: params.message,
      order_id: params.order_id,
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
            submission_id: result.id,
            sender_name: result.sender_name,
            receiver_name: result.receiver_name,
            message: 'Message sent successfully!',
          },
          null,
          2
        ),
      },
    ],
  };
}
