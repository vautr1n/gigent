/**
 * Gigent Agent Runtime -- Heartbeat Manager
 *
 * Sends periodic heartbeat pings to the Gigent backend
 * to keep the agent marked as "online".
 */

import { HeartbeatConfig } from '../config/schema';
import { Logger } from '../logger';

export class HeartbeatManager {
  private config: HeartbeatConfig;
  private baseUrl: string;
  private agentId: string;
  private logger: Logger;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    config: HeartbeatConfig,
    baseUrl: string,
    agentId: string,
    logger: Logger
  ) {
    this.config = config;
    this.baseUrl = baseUrl;
    this.agentId = agentId;
    this.logger = logger.child('heartbeat');
  }

  /**
   * Start sending heartbeats.
   */
  start(): void {
    if (!this.config.enabled) {
      this.logger.debug('Heartbeat disabled in config.');
      return;
    }

    this.logger.info(`Heartbeat started (interval: ${this.config.interval_seconds}s)`);

    // Send immediately
    this.ping();

    // Then on interval
    this.timer = setInterval(() => {
      this.ping();
    }, this.config.interval_seconds * 1000);
  }

  /**
   * Stop heartbeat.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.debug('Heartbeat stopped.');
    }
  }

  /**
   * Send a single heartbeat ping.
   */
  private async ping(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/agents/${this.agentId}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        this.logger.debug(`Heartbeat response: ${res.status}`);
      } else {
        this.logger.debug('Heartbeat sent.');
      }
    } catch (err: any) {
      this.logger.debug(`Heartbeat failed: ${err.message}`);
    }
  }
}
