/**
 * Gigent Agent Runtime -- Delivery Manager
 *
 * Formats LLM output and delivers results to the Gigent backend.
 */

import { DeliveryConfig } from '../config/schema';
import { Logger } from '../logger';

export class DeliveryManager {
  private config: DeliveryConfig;
  private baseUrl: string;
  private agentId: string;
  private logger: Logger;

  constructor(
    config: DeliveryConfig,
    baseUrl: string,
    agentId: string,
    logger: Logger
  ) {
    this.config = config;
    this.baseUrl = baseUrl;
    this.agentId = agentId;
    this.logger = logger.child('delivery');
  }

  /**
   * Format the result and deliver it for an order.
   */
  async deliver(orderId: string, rawResult: string): Promise<void> {
    const formatted = this.format(rawResult);

    this.logger.debug(`Delivering order ${orderId} (format: ${this.config.format})...`);

    const body = {
      agent_id: this.agentId,
      delivery_data: formatted,
    };

    try {
      const res = await fetch(`${this.baseUrl}/api/orders/${orderId}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as any;

      if (!res.ok) {
        throw new Error(data.error || `Delivery failed with status ${res.status}`);
      }

      this.logger.info(`Order ${orderId} delivered successfully.`);
    } catch (err: any) {
      this.logger.error(`Failed to deliver order ${orderId}: ${err.message}`);

      // Retry once
      try {
        this.logger.info(`Retrying delivery for order ${orderId}...`);
        const res = await fetch(`${this.baseUrl}/api/orders/${orderId}/deliver`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = (await res.json()) as any;
          throw new Error(data.error || `Retry delivery failed with status ${res.status}`);
        }

        this.logger.info(`Order ${orderId} delivered on retry.`);
      } catch (retryErr: any) {
        this.logger.error(`Retry delivery also failed for order ${orderId}: ${retryErr.message}`);
        throw retryErr;
      }
    }
  }

  /**
   * Format the LLM output based on the configured delivery format.
   */
  private format(rawResult: string): any {
    switch (this.config.format) {
      case 'json':
        return this.formatAsJson(rawResult);
      case 'text':
        return { content: rawResult, format: 'text' };
      case 'markdown':
      default:
        return { content: rawResult, format: 'markdown' };
    }
  }

  /**
   * Attempt to parse the result as JSON, wrap in a result object if it fails.
   */
  private formatAsJson(rawResult: string): any {
    try {
      const parsed = JSON.parse(rawResult);
      return { result: parsed, format: 'json' };
    } catch {
      // If the LLM output contains a JSON block, try to extract it
      const jsonMatch = rawResult.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1].trim());
          return { result: parsed, format: 'json' };
        } catch {
          // Fall through
        }
      }

      // Not valid JSON -- wrap as text
      return { result: rawResult, format: 'text' };
    }
  }
}
