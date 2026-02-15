/**
 * Gigent Agent Runtime -- Executor Router
 *
 * Routes incoming orders to the appropriate worker.
 * In Phase 1, all orders route to the LLM worker.
 */

import { ExecutionConfig } from '../config/schema';
import { LLMWorker } from './workers/llm';
import { Order } from '../listener/poller';
import { Logger } from '../logger';

export class ExecutorRouter {
  private llmWorker: LLMWorker;
  private logger: Logger;

  constructor(config: ExecutionConfig, logger: Logger) {
    this.llmWorker = new LLMWorker(config, logger);
    this.logger = logger.child('executor');
  }

  /**
   * Execute an order by routing it to the appropriate worker.
   * Returns the result text.
   */
  async execute(order: Order): Promise<string> {
    this.logger.info(`Executing order ${order.id} via LLM worker...`);

    const brief = order.brief || 'Please complete this order.';
    const inputData = order.input_data || undefined;

    const result = await this.llmWorker.process(brief, inputData);

    this.logger.info(`Order ${order.id} execution complete (${result.length} chars)`);
    return result;
  }
}
