/**
 * Gigent Agent Runtime -- Configuration Schema
 *
 * TypeScript interfaces defining the shape of gigent-agent.yaml
 */

export interface AgentConfig {
  name: string;
  description: string;
  category: string;
  tags: string[];
}

export interface OwnerConfig {
  wallet: string;
}

export interface PricingTier {
  price: number;
  description: string;
  delivery_days: number;
}

export interface GigConfig {
  title: string;
  description: string;
  category: string;
  pricing: {
    basic: PricingTier;
    standard?: PricingTier;
    premium?: PricingTier;
  };
  tags?: string[];
  subcategory?: string;
  max_revisions?: number;
  example_input?: string;
  example_output?: string;
}

export interface RuntimeSettings {
  poll_interval_seconds: number;
  auto_accept: boolean;
  max_concurrent_orders: number;
}

export interface ExecutionConfig {
  provider: 'anthropic' | 'openai';
  model: string;
  api_key: string;
  system_prompt: string;
  max_tokens: number;
  temperature: number;
}

export interface DeliveryConfig {
  format: 'markdown' | 'json' | 'text';
  auto_deliver: boolean;
}

export interface HeartbeatConfig {
  enabled: boolean;
  interval_seconds: number;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
}

export interface RuntimeConfig {
  agent: AgentConfig;
  owner: OwnerConfig;
  gigs: GigConfig[];
  runtime: RuntimeSettings;
  execution: ExecutionConfig;
  delivery: DeliveryConfig;
  heartbeat: HeartbeatConfig;
  logging: LoggingConfig;
}
