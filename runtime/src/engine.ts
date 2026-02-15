/**
 * Gigent Agent Runtime -- RuntimeEngine
 *
 * The main orchestrator that ties together all runtime components:
 * config loading, boot (register + publish), heartbeat, polling, execution, and delivery.
 */

import { loadConfig } from './config/loader';
import { RuntimeConfig } from './config/schema';
import { loadCredentials, Credentials, maskApiKey } from './boot/credentials';
import { registerAgent } from './boot/register';
import { publishGigs } from './boot/publish';
import { OrderPoller, Order } from './listener/poller';
import { ExecutorRouter } from './executor/router';
import { DeliveryManager } from './delivery/deliver';
import { HeartbeatManager } from './heartbeat/heartbeat';
import { Logger } from './logger';

const DEFAULT_BASE_URL = 'http://localhost:3000';

export interface RuntimeStatus {
  agent_id: string | null;
  agent_name: string;
  is_running: boolean;
  active_orders: number;
  uptime_seconds: number;
  gigs_configured: number;
  base_url: string;
}

export class RuntimeEngine {
  private config: RuntimeConfig | null = null;
  private credentials: Credentials | null = null;
  private logger: Logger;
  private poller: OrderPoller | null = null;
  private executor: ExecutorRouter | null = null;
  private delivery: DeliveryManager | null = null;
  private heartbeat: HeartbeatManager | null = null;
  private baseUrl: string;
  private startTime: number = 0;
  private _isRunning: boolean = false;
  private configPath: string | undefined;

  constructor(configPath?: string, baseUrl?: string) {
    this.configPath = configPath;
    this.baseUrl = baseUrl || DEFAULT_BASE_URL;
    this.logger = new Logger('info');
  }

  /**
   * Start the runtime engine. This is the main entry point.
   *
   * 1. Load config
   * 2. Load or create credentials
   * 3. Publish gigs
   * 4. Start heartbeat
   * 5. Start polling for orders
   */
  async start(): Promise<void> {
    this.startTime = Date.now();

    // --- Step 1: Load config ---
    this.logger.info('Loading configuration...');
    this.config = loadConfig(this.configPath);
    this.logger = new Logger(this.config.logging.level);

    this.logger.info(`Agent: "${this.config.agent.name}"`);
    this.logger.info(`Category: ${this.config.agent.category}`);
    this.logger.info(`Gigs: ${this.config.gigs.length} configured`);
    this.logger.info(`LLM Provider: ${this.config.execution.provider} (${this.config.execution.model})`);

    // --- Step 2: Load or create credentials ---
    this.logger.info('Checking credentials...');
    this.credentials = loadCredentials();

    if (this.credentials) {
      this.logger.info(
        `Existing credentials found: agent ${this.credentials.agent_id} (API key: ${maskApiKey(this.credentials.api_key)})`
      );
    } else {
      this.logger.info('No credentials found. Registering new agent...');
      const result = await registerAgent(
        this.baseUrl,
        this.config.agent,
        this.config.owner,
        this.logger
      );
      this.credentials = result.credentials;
    }

    // --- Step 3: Publish gigs ---
    this.logger.info('Publishing gigs...');
    await publishGigs(this.baseUrl, this.credentials.agent_id, this.config.gigs, this.logger);

    // --- Step 4: Initialize components ---
    this.executor = new ExecutorRouter(this.config.execution, this.logger);
    this.delivery = new DeliveryManager(
      this.config.delivery,
      this.baseUrl,
      this.credentials.agent_id,
      this.logger
    );

    // --- Step 5: Start heartbeat ---
    this.heartbeat = new HeartbeatManager(
      this.config.heartbeat,
      this.baseUrl,
      this.credentials.agent_id,
      this.logger
    );
    this.heartbeat.start();

    // --- Step 6: Start polling ---
    this.poller = new OrderPoller(
      this.baseUrl,
      this.credentials.agent_id,
      this.config.runtime,
      this.logger
    );
    this.poller.start((order) => this.handleOrder(order));

    this._isRunning = true;

    this.logger.info('========================================');
    this.logger.info('  Agent is online and ready!');
    this.logger.info(`  Name: ${this.config.agent.name}`);
    this.logger.info(`  ID: ${this.credentials.agent_id}`);
    this.logger.info(`  Backend: ${this.baseUrl}`);
    this.logger.info(`  Polling every ${this.config.runtime.poll_interval_seconds}s`);
    this.logger.info('========================================');

    // --- Register shutdown handlers ---
    const shutdown = () => this.stop();
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  /**
   * Stop the runtime engine gracefully.
   */
  async stop(): Promise<void> {
    if (!this._isRunning) return;

    this.logger.info('Shutting down...');
    this._isRunning = false;

    // Stop polling
    if (this.poller) {
      this.poller.stop();
    }

    // Stop heartbeat
    if (this.heartbeat) {
      this.heartbeat.stop();
    }

    // Wait for active orders to finish (with 30s timeout)
    if (this.poller && this.poller.hasActiveOrders) {
      this.logger.info(
        `Waiting for ${this.poller.activeOrderCount} active order(s) to complete...`
      );

      const timeout = 30000;
      const start = Date.now();

      while (this.poller.hasActiveOrders && Date.now() - start < timeout) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (this.poller.hasActiveOrders) {
        this.logger.warn('Timed out waiting for active orders. Forcing shutdown.');
      }
    }

    this.logger.info('Shutdown complete.');
    process.exit(0);
  }

  /**
   * Get current runtime status.
   */
  async getStatus(): Promise<RuntimeStatus> {
    // Load config if not already loaded
    if (!this.config) {
      try {
        this.config = loadConfig(this.configPath);
      } catch {
        // Config might not exist
      }
    }

    // Load credentials if not already loaded
    if (!this.credentials) {
      this.credentials = loadCredentials();
    }

    return {
      agent_id: this.credentials?.agent_id || null,
      agent_name: this.config?.agent.name || 'Unknown',
      is_running: this._isRunning,
      active_orders: this.poller?.activeOrderCount || 0,
      uptime_seconds: this.startTime > 0 ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      gigs_configured: this.config?.gigs.length || 0,
      base_url: this.baseUrl,
    };
  }

  /**
   * Handle a new order: accept -> start work -> execute -> deliver.
   */
  private async handleOrder(order: Order): Promise<void> {
    if (!this.config || !this.credentials || !this.executor || !this.delivery || !this.poller) {
      return;
    }

    try {
      // --- Accept order ---
      if (this.config.runtime.auto_accept) {
        this.logger.info(`Accepting order ${order.id}...`);
        await this.updateOrderStatus(order.id, 'accepted');
      }

      // --- Start work ---
      this.logger.info(`Starting work on order ${order.id}...`);
      await this.updateOrderStatus(order.id, 'in_progress');

      // --- Execute via LLM ---
      this.logger.info(`Executing order ${order.id} via LLM...`);
      const result = await this.executor.execute(order);

      // --- Deliver ---
      if (this.config.delivery.auto_deliver) {
        this.logger.info(`Delivering order ${order.id}...`);
        await this.delivery.deliver(order.id, result);
      }

      this.logger.info(`Order ${order.id} completed successfully.`);
      this.poller.orderCompleted(order.id);
    } catch (err: any) {
      this.logger.error(`Order ${order.id} failed: ${err.message}`);
      this.poller?.orderFailed(order.id);
    }
  }

  /**
   * Update an order's status via the backend API.
   */
  private async updateOrderStatus(orderId: string, status: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        agent_id: this.credentials!.agent_id,
      }),
    });

    if (!res.ok) {
      const data = (await res.json()) as any;
      throw new Error(data.error || `Failed to update order status to "${status}"`);
    }
  }
}
