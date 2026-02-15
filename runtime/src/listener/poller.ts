/**
 * Gigent Agent Runtime -- Order Poller
 *
 * Periodically polls the backend for new pending orders,
 * dispatches them to the order handler callback.
 */

import { RuntimeSettings } from '../config/schema';
import { Logger } from '../logger';

export interface Order {
  id: string;
  gig_id: string;
  buyer_id: string;
  seller_id: string;
  tier: string;
  price: number;
  status: string;
  brief: string | null;
  input_data: string | null;
  gig_title?: string;
  buyer_name?: string;
  created_at: string;
}

export type OrderHandler = (order: Order) => Promise<void>;

export class OrderPoller {
  private baseUrl: string;
  private agentId: string;
  private config: RuntimeSettings;
  private logger: Logger;
  private timer: ReturnType<typeof setInterval> | null = null;
  private activeOrders: Set<string> = new Set();
  private processingOrderIds: Set<string> = new Set();
  private onNewOrder: OrderHandler | null = null;
  private _isRunning: boolean = false;

  constructor(
    baseUrl: string,
    agentId: string,
    config: RuntimeSettings,
    logger: Logger
  ) {
    this.baseUrl = baseUrl;
    this.agentId = agentId;
    this.config = config;
    this.logger = logger.child('poller');
  }

  /**
   * Start polling for orders.
   */
  start(handler: OrderHandler): void {
    this.onNewOrder = handler;
    this._isRunning = true;
    this.logger.info(
      `Order poller started (interval: ${this.config.poll_interval_seconds}s, max concurrent: ${this.config.max_concurrent_orders})`
    );

    // Poll immediately on start
    this.poll();

    // Then poll on interval
    this.timer = setInterval(() => {
      this.poll();
    }, this.config.poll_interval_seconds * 1000);
  }

  /**
   * Stop polling.
   */
  stop(): void {
    this._isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.info('Order poller stopped.');
  }

  /**
   * Check if there are orders currently being processed.
   */
  get hasActiveOrders(): boolean {
    return this.activeOrders.size > 0;
  }

  /**
   * Get count of active orders.
   */
  get activeOrderCount(): number {
    return this.activeOrders.size;
  }

  /**
   * Mark an order as completed (remove from active set).
   */
  orderCompleted(orderId: string): void {
    this.activeOrders.delete(orderId);
    this.processingOrderIds.delete(orderId);
  }

  /**
   * Mark an order as failed (remove from active set).
   */
  orderFailed(orderId: string): void {
    this.activeOrders.delete(orderId);
    this.processingOrderIds.delete(orderId);
  }

  private async poll(): Promise<void> {
    if (!this._isRunning || !this.onNewOrder) return;

    try {
      const url = `${this.baseUrl}/api/orders?agent_id=${this.agentId}&role=seller`;
      const res = await fetch(url);

      if (!res.ok) {
        this.logger.warn(`Poll failed with status ${res.status}`);
        return;
      }

      const data = (await res.json()) as any;
      const orders: Order[] = data.orders || [];

      // Filter for pending orders that we haven't already picked up
      const pendingOrders = orders.filter(
        (o: Order) => o.status === 'pending' && !this.processingOrderIds.has(o.id)
      );

      if (pendingOrders.length > 0) {
        this.logger.debug(`Found ${pendingOrders.length} pending order(s)`);
      }

      for (const order of pendingOrders) {
        // Check concurrency limit
        if (this.activeOrders.size >= this.config.max_concurrent_orders) {
          this.logger.debug(
            `Concurrency limit reached (${this.activeOrders.size}/${this.config.max_concurrent_orders}), skipping remaining orders`
          );
          break;
        }

        // Mark as being processed
        this.activeOrders.add(order.id);
        this.processingOrderIds.add(order.id);

        this.logger.info(
          `New order: ${order.id} | "${order.gig_title || 'Unknown gig'}" | $${order.price} | from ${order.buyer_name || order.buyer_id}`
        );

        // Dispatch asynchronously (don't block the poll loop)
        this.onNewOrder(order).catch((err: any) => {
          this.logger.error(`Order ${order.id} processing error: ${err.message}`);
          this.orderFailed(order.id);
        });
      }
    } catch (err: any) {
      this.logger.warn(`Poll error: ${err.message}`);
    }
  }
}
