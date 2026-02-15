/**
 * Gigent Agent Runtime -- Config Loader
 *
 * Loads and validates gigent-agent.yaml, returning a typed RuntimeConfig.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';
import { RuntimeConfig } from './schema';

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Load and validate a gigent-agent.yaml config file.
 */
export function loadConfig(configPath?: string): RuntimeConfig {
  const resolvedPath = configPath || path.resolve(process.cwd(), 'gigent-agent.yaml');

  if (!fs.existsSync(resolvedPath)) {
    throw new ConfigValidationError(
      `Config file not found: ${resolvedPath}\nRun "gigent-runtime init" to generate a template.`
    );
  }

  const raw = fs.readFileSync(resolvedPath, 'utf-8');
  let parsed: any;

  try {
    parsed = parse(raw);
  } catch (err: any) {
    throw new ConfigValidationError(`Failed to parse YAML: ${err.message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ConfigValidationError('Config file is empty or not a valid YAML object.');
  }

  // --- Validate agent section ---
  if (!parsed.agent || typeof parsed.agent !== 'object') {
    throw new ConfigValidationError('Missing "agent" section in config.');
  }
  if (!parsed.agent.name || typeof parsed.agent.name !== 'string') {
    throw new ConfigValidationError('agent.name is required and must be a string.');
  }
  if (!parsed.agent.description || typeof parsed.agent.description !== 'string') {
    throw new ConfigValidationError('agent.description is required and must be a string.');
  }
  if (!parsed.agent.category || typeof parsed.agent.category !== 'string') {
    throw new ConfigValidationError('agent.category is required and must be a string.');
  }

  // --- Validate owner section ---
  if (!parsed.owner || typeof parsed.owner !== 'object') {
    throw new ConfigValidationError('Missing "owner" section in config.');
  }
  if (!parsed.owner.wallet || typeof parsed.owner.wallet !== 'string') {
    throw new ConfigValidationError('owner.wallet is required and must be a string.');
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(parsed.owner.wallet)) {
    throw new ConfigValidationError(
      `owner.wallet must be a valid Ethereum address (0x + 40 hex chars). Got: ${parsed.owner.wallet}`
    );
  }

  // --- Validate gigs section ---
  if (!parsed.gigs || !Array.isArray(parsed.gigs) || parsed.gigs.length === 0) {
    throw new ConfigValidationError('At least one gig is required in the "gigs" section.');
  }
  for (let i = 0; i < parsed.gigs.length; i++) {
    const gig = parsed.gigs[i];
    if (!gig.title) throw new ConfigValidationError(`gigs[${i}].title is required.`);
    if (!gig.description) throw new ConfigValidationError(`gigs[${i}].description is required.`);
    if (!gig.category) throw new ConfigValidationError(`gigs[${i}].category is required.`);
    if (!gig.pricing || !gig.pricing.basic) {
      throw new ConfigValidationError(`gigs[${i}].pricing.basic is required.`);
    }
    if (typeof gig.pricing.basic.price !== 'number' || gig.pricing.basic.price <= 0) {
      throw new ConfigValidationError(`gigs[${i}].pricing.basic.price must be a positive number.`);
    }
    if (!gig.pricing.basic.description) {
      throw new ConfigValidationError(`gigs[${i}].pricing.basic.description is required.`);
    }
  }

  // --- Validate execution section ---
  if (!parsed.execution || typeof parsed.execution !== 'object') {
    throw new ConfigValidationError('Missing "execution" section in config.');
  }
  if (!['anthropic', 'openai'].includes(parsed.execution.provider)) {
    throw new ConfigValidationError(
      `execution.provider must be "anthropic" or "openai". Got: ${parsed.execution.provider}`
    );
  }
  if (!parsed.execution.model || typeof parsed.execution.model !== 'string') {
    throw new ConfigValidationError('execution.model is required and must be a string.');
  }
  if (!parsed.execution.api_key || typeof parsed.execution.api_key !== 'string') {
    throw new ConfigValidationError(
      'execution.api_key is required. Set your LLM provider API key.'
    );
  }

  // --- Apply defaults ---
  const config: RuntimeConfig = {
    agent: {
      name: parsed.agent.name,
      description: parsed.agent.description,
      category: parsed.agent.category,
      tags: parsed.agent.tags || [],
    },
    owner: {
      wallet: parsed.owner.wallet,
    },
    gigs: parsed.gigs.map((g: any) => ({
      title: g.title,
      description: g.description,
      category: g.category,
      subcategory: g.subcategory || undefined,
      tags: g.tags || [],
      pricing: {
        basic: {
          price: g.pricing.basic.price,
          description: g.pricing.basic.description,
          delivery_days: g.pricing.basic.delivery_days || 1,
        },
        standard: g.pricing.standard
          ? {
              price: g.pricing.standard.price,
              description: g.pricing.standard.description,
              delivery_days: g.pricing.standard.delivery_days || 2,
            }
          : undefined,
        premium: g.pricing.premium
          ? {
              price: g.pricing.premium.price,
              description: g.pricing.premium.description,
              delivery_days: g.pricing.premium.delivery_days || 3,
            }
          : undefined,
      },
      max_revisions: g.max_revisions || 1,
      example_input: g.example_input || undefined,
      example_output: g.example_output || undefined,
    })),
    runtime: {
      poll_interval_seconds: parsed.runtime?.poll_interval_seconds ?? 10,
      auto_accept: parsed.runtime?.auto_accept ?? true,
      max_concurrent_orders: parsed.runtime?.max_concurrent_orders ?? 3,
    },
    execution: {
      provider: parsed.execution.provider,
      model: parsed.execution.model,
      api_key: parsed.execution.api_key,
      system_prompt: parsed.execution.system_prompt || 'You are a helpful assistant.',
      max_tokens: parsed.execution.max_tokens ?? 4096,
      temperature: parsed.execution.temperature ?? 0.7,
    },
    delivery: {
      format: parsed.delivery?.format || 'markdown',
      auto_deliver: parsed.delivery?.auto_deliver ?? true,
    },
    heartbeat: {
      enabled: parsed.heartbeat?.enabled ?? true,
      interval_seconds: parsed.heartbeat?.interval_seconds ?? 30,
    },
    logging: {
      level: parsed.logging?.level || 'info',
    },
  };

  return config;
}
