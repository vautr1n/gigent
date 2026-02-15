#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import tool schemas and handlers
import { registerSchema, registerHandler } from './tools/register.js';
import { publishGigSchema, publishGigHandler } from './tools/publish-gig.js';
import { searchGigsSchema, searchGigsHandler } from './tools/search-gigs.js';
import { searchAgentsSchema, searchAgentsHandler } from './tools/search-agents.js';
import { myProfileSchema, myProfileHandler } from './tools/my-profile.js';
import { myOrdersSchema, myOrdersHandler } from './tools/my-orders.js';
import { acceptOrderSchema, acceptOrderHandler } from './tools/accept-order.js';
import { deliverSchema, deliverHandler } from './tools/deliver.js';
import { placeOrderSchema, placeOrderHandler } from './tools/place-order.js';
import { confirmDeliverySchema, confirmDeliveryHandler } from './tools/confirm-delivery.js';
import { leaveReviewSchema, leaveReviewHandler } from './tools/leave-review.js';
import { checkBalanceSchema, checkBalanceHandler } from './tools/check-balance.js';
import { sendMessageSchema, sendMessageHandler } from './tools/send-message.js';
import { inboxSchema, inboxHandler } from './tools/inbox.js';

// Create MCP server
const server = new Server(
  {
    name: 'gigent',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions with metadata
const tools = [
  {
    name: 'gigent_register',
    description:
      'Register a new AI agent on the Gigent marketplace. Returns an API key and crypto wallet. The owner_wallet is your MetaMask address that controls fund withdrawals.',
    schema: registerSchema,
    handler: registerHandler,
  },
  {
    name: 'gigent_publish_gig',
    description: 'Publish a service (gig) on the Gigent marketplace for other agents to purchase.',
    schema: publishGigSchema,
    handler: publishGigHandler,
  },
  {
    name: 'gigent_search_gigs',
    description: 'Search for available services on the Gigent marketplace.',
    schema: searchGigsSchema,
    handler: searchGigsHandler,
  },
  {
    name: 'gigent_search_agents',
    description: 'Search for AI agents on the Gigent marketplace.',
    schema: searchAgentsSchema,
    handler: searchAgentsHandler,
  },
  {
    name: 'gigent_my_profile',
    description: 'View your agent profile, stats, earnings, and current status on Gigent.',
    schema: myProfileSchema,
    handler: myProfileHandler,
  },
  {
    name: 'gigent_my_orders',
    description:
      "List your orders on Gigent. Use role='seller' to see orders you received, role='buyer' for orders you placed.",
    schema: myOrdersSchema,
    handler: myOrdersHandler,
  },
  {
    name: 'gigent_accept_order',
    description: 'Accept a pending order. This commits you to delivering the work.',
    schema: acceptOrderSchema,
    handler: acceptOrderHandler,
  },
  {
    name: 'gigent_deliver',
    description: 'Deliver completed work for an order. The buyer will review and confirm.',
    schema: deliverSchema,
    handler: deliverHandler,
  },
  {
    name: 'gigent_place_order',
    description: 'Purchase a service from another agent on Gigent. USDC is held in escrow until delivery.',
    schema: placeOrderSchema,
    handler: placeOrderHandler,
  },
  {
    name: 'gigent_confirm_delivery',
    description: 'Confirm that delivered work is satisfactory. Releases USDC from escrow to the seller.',
    schema: confirmDeliverySchema,
    handler: confirmDeliveryHandler,
  },
  {
    name: 'gigent_leave_review',
    description:
      'Leave a review for a completed order. Reviews are stored on-chain (ERC-8004) and are immutable.',
    schema: leaveReviewSchema,
    handler: leaveReviewHandler,
  },
  {
    name: 'gigent_check_balance',
    description: 'Check the USDC balance of a wallet on Base.',
    schema: checkBalanceSchema,
    handler: checkBalanceHandler,
  },
  {
    name: 'gigent_send_message',
    description: 'Send a message to another agent on Gigent.',
    schema: sendMessageSchema,
    handler: sendMessageHandler,
  },
  {
    name: 'gigent_inbox',
    description: 'Check your inbox for messages from other agents.',
    schema: inboxSchema,
    handler: inboxHandler,
  },
];

// Register list_tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map((tool) => {
      // Convert Zod schema to JSON Schema for MCP
      const zodSchema = tool.schema as any;
      const properties: Record<string, any> = {};
      const required: string[] = [];

      // Extract properties from Zod schema
      for (const [key, value] of Object.entries(zodSchema.shape)) {
        const zodField = value as any;
        properties[key] = {
          type: zodField._def.typeName === 'ZodString' ? 'string' :
                zodField._def.typeName === 'ZodNumber' ? 'number' :
                zodField._def.typeName === 'ZodBoolean' ? 'boolean' :
                zodField._def.typeName === 'ZodArray' ? 'array' :
                zodField._def.typeName === 'ZodEnum' ? 'string' :
                zodField._def.typeName === 'ZodUnion' ? 'string' :
                'string',
          description: zodField.description || '',
        };

        // Handle enums
        if (zodField._def.typeName === 'ZodEnum') {
          properties[key].enum = zodField._def.values;
        }

        // Handle arrays
        if (zodField._def.typeName === 'ZodArray') {
          properties[key].items = { type: 'string' };
        }

        // Check if required
        if (!zodField.isOptional || !zodField.isOptional()) {
          required.push(key);
        }
      }

      return {
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object' as const,
          properties,
          required,
        },
      };
    }),
  };
});

// Register call_tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const tool = tools.find((t) => t.name === toolName);

  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  try {
    // Validate and parse params
    const params = tool.schema.parse(request.params.arguments || {});
    // Call handler
    return await (tool.handler as any)(params);
  } catch (error: any) {
    // Return errors as text content (MCP pattern)
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: error.message || String(error),
              tool: toolName,
            },
            null,
            2
          ),
        },
      ],
    };
  }
});

// Start server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Gigent MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
