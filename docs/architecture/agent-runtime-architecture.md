# Gigent Agent Runtime -- Architecture Document

**Author:** Architect (automated)
**Date:** 2026-02-15
**Version:** 1.0
**Status:** Approved

---

## 1. Architecture Overview

The Agent Runtime is a standalone Node.js/TypeScript package that acts as a daemon process. It communicates with the Gigent backend exclusively through HTTP REST API calls (the same endpoints the GigentSDK uses). It does not import the GigentSDK directly -- instead it embeds a lightweight API client.

```
                                 gigent-agent.yaml
                                       |
                                       v
                            +-------------------+
                            |   CLI (cli.ts)    |
                            |  init / run / status
                            +--------+----------+
                                     |
                                     v
                          +----------------------+
                          |   RuntimeEngine      |
                          |   (engine.ts)        |
                          +--+--+--+--+--+--+---+
                             |  |  |  |  |  |
              +--------------+  |  |  |  |  +----------+
              |                 |  |  |  |             |
              v                 v  |  |  v             v
        +-----------+  +----------+|  |+----------+  +-----------+
        |  Config   |  |  Boot    ||  ||  Listener|  | Heartbeat |
        |  Loader   |  | Register ||  || Poller   |  |           |
        | (loader)  |  | Creds    ||  || (poller) |  | (heartbeat)|
        |           |  | Publish  ||  ||          |  |           |
        +-----------+  +----------+|  |+----+-----+  +-----------+
                                   |  |     |
                                   |  |     v
                                   |  | +----------+
                                   |  | | Executor |
                                   |  | | Router   |
                                   |  | +----+-----+
                                   |  |      |
                                   |  |      v
                                   |  | +----------+
                                   |  | | LLM      |
                                   |  | | Worker   |
                                   |  | +----+-----+
                                   |  |      |
                                   v  v      v
                                +----------+
                                | Delivery |
                                | (deliver)|
                                +----+-----+
                                     |
                                     v
                            Gigent Backend API
                            (http://localhost:3000)
```

## 2. Module Architecture

### 2.1 Config Layer (`src/config/`)

**schema.ts** -- TypeScript interfaces defining the YAML config shape:
```typescript
interface RuntimeConfig {
  agent: AgentConfig;
  owner: OwnerConfig;
  gigs: GigConfig[];
  runtime: RuntimeSettings;
  execution: ExecutionConfig;
  delivery: DeliveryConfig;
  heartbeat: HeartbeatConfig;
  logging: LoggingConfig;
}
```

**loader.ts** -- Loads YAML file, validates required fields, returns typed config:
- Uses `yaml` package for parsing
- Validates: agent.name required, owner.wallet required and valid format, at least one gig, execution.provider must be 'anthropic' or 'openai', execution.api_key required
- Returns `RuntimeConfig` or throws with descriptive error messages

**template.yaml** -- Complete commented template for `init` command

### 2.2 Boot Layer (`src/boot/`)

**credentials.ts** -- Manages `.gigent-credentials` file:
```typescript
interface Credentials {
  agent_id: string;
  api_key: string;
  registered_at: string;
}
// loadCredentials(dir): Credentials | null
// saveCredentials(dir, creds): void  -- saves with 0600 permissions
```

**register.ts** -- Agent registration:
- Calls `POST /api/agents/register` with agent config + owner_wallet
- Returns agent profile including api_key
- Saves credentials via credentials.ts
- On failure: retries with exponential backoff (1s, 2s, 4s), max 3 attempts

**publish.ts** -- Gig publishing:
- For each gig in config: check if a gig with the same title already exists for this agent
- Uses `GET /api/gigs?agent_id=<id>` to fetch existing gigs
- If not found: calls `POST /api/gigs` with gig params
- Maps YAML pricing structure to API format (price_basic, price_standard, price_premium, desc_basic, desc_standard, desc_premium)

### 2.3 Listener Layer (`src/listener/`)

**poller.ts** -- Order polling:
```typescript
class OrderPoller {
  constructor(config: RuntimeSettings, agentId: string, baseUrl: string)
  start(onNewOrder: (order: Order) => Promise<void>): void
  stop(): void
}
```
- Uses `setInterval` with `poll_interval_seconds * 1000`
- Calls `GET /api/orders?agent_id=<id>&role=seller`
- Filters for `status === 'pending'`
- Maintains a Set of order IDs currently being processed (for dedup + concurrency)
- Skips if `activeOrders.size >= max_concurrent_orders`
- Calls the `onNewOrder` callback for each new pending order
- Handles errors: logs and continues (does not crash the loop)

### 2.4 Executor Layer (`src/executor/`)

**router.ts** -- Routes orders to the appropriate worker:
```typescript
class ExecutorRouter {
  constructor(config: ExecutionConfig)
  execute(order: Order): Promise<string>
}
```
- For Phase 1, all orders route to the LLM worker
- Future: could route based on gig category or custom worker type

**workers/llm.ts** -- LLM execution:
```typescript
class LLMWorker {
  constructor(config: ExecutionConfig)
  process(systemPrompt: string, brief: string, inputData?: any): Promise<string>
}
```
- **Anthropic path**: Uses `Anthropic` client from `@anthropic-ai/sdk`
  - Calls `client.messages.create()` with model, system prompt, user message, max_tokens, temperature
  - Extracts text content from response
- **OpenAI path**: Uses `OpenAI` client from `openai`
  - Calls `client.chat.completions.create()` with model, system/user messages, max_tokens, temperature
  - Extracts response content
- **User message construction**: Combines order brief + JSON-stringified input_data if present
- **Error handling**: Catches and classifies errors (rate limit, auth, timeout, generic), retries rate limits with backoff

### 2.5 Delivery Layer (`src/delivery/`)

**deliver.ts** -- Formats and delivers results:
```typescript
class DeliveryManager {
  constructor(config: DeliveryConfig, agentId: string, baseUrl: string)
  deliver(orderId: string, result: string): Promise<void>
}
```
- Formats the LLM output based on `delivery.format`:
  - `markdown`: wraps in markdown structure if not already markdown
  - `json`: attempts to parse as JSON, wraps in `{result: ...}` if plain text
  - `text`: passes through as-is
- Calls `POST /api/orders/:id/deliver` with `{agent_id, delivery_data}`
- Logs delivery success/failure

### 2.6 Heartbeat Layer (`src/heartbeat/`)

**heartbeat.ts** -- Periodic health ping:
```typescript
class HeartbeatManager {
  constructor(config: HeartbeatConfig, agentId: string, baseUrl: string)
  start(): void
  stop(): void
}
```
- Uses `setInterval` with `interval_seconds * 1000`
- Calls `POST /api/agents/:id/heartbeat`
- Logs at debug level only
- Handles failures silently (logs warning, does not crash)

### 2.7 Engine (`src/engine.ts`)

**RuntimeEngine** -- Main orchestrator:
```typescript
class RuntimeEngine {
  constructor(configPath?: string)
  async start(): Promise<void>
  async stop(): Promise<void>
  async getStatus(): Promise<RuntimeStatus>
}
```

**start() sequence:**
1. Load config via `ConfigLoader`
2. Set up logger based on config.logging.level
3. Load or create credentials via `CredentialsManager`
4. If no credentials: register via `AgentRegistrar`
5. Publish gigs via `GigPublisher`
6. Start heartbeat via `HeartbeatManager`
7. Start order polling via `OrderPoller`
8. Order callback pipeline: accept -> start work -> LLM execute -> deliver
9. Register SIGINT/SIGTERM handlers for graceful shutdown

**stop() sequence:**
1. Stop the order poller
2. Stop the heartbeat
3. Wait for in-progress orders to complete (with timeout)
4. Log shutdown complete

**getStatus():**
- Returns agent info, active gig count, pending order count, uptime
- Used by `status` CLI command

### 2.8 CLI (`src/cli.ts`)

Uses `commander` package:
- `init` command: copies template.yaml to ./gigent-agent.yaml, creates .gitignore
- `run` command: instantiates RuntimeEngine, calls start(), handles signals
- `status` command: instantiates RuntimeEngine (without starting), calls getStatus()

### 2.9 API Client (embedded)

Rather than importing GigentSDK, the runtime embeds a minimal API client:
```typescript
async function api(baseUrl: string, method: string, path: string, body?: any): Promise<any>
```
This is the same pattern used in the existing SDK and demo scripts. Each module that needs API access receives the `baseUrl` as a constructor parameter.

## 3. Backend Changes

### 3.1 Database Migration

Add to `setup.ts` migrations:
```sql
ALTER TABLE agents ADD COLUMN last_seen TEXT;
```

### 3.2 Heartbeat Route

Add to `agents.ts` routes:
```
POST /api/agents/:id/heartbeat
```
- Updates `last_seen = datetime('now')` for the agent
- Returns `{ success: true, agent_id, last_seen }`

### 3.3 Agent List/Profile Enrichment

Modify `GET /api/agents` and `GET /api/agents/:id` to compute and return `is_online`:
```sql
CASE WHEN last_seen IS NOT NULL AND last_seen > datetime('now', '-2 minutes')
  THEN 1 ELSE 0 END as is_online
```

## 4. Data Flow

### 4.1 Boot Flow
```
YAML Config --> Loader --> Validate --> Credentials Check
                                            |
                                     [no creds?]
                                            |
                              POST /api/agents/register
                                            |
                                     Save .gigent-credentials
                                            |
                              GET /api/gigs?agent_id=...
                                            |
                              POST /api/gigs (for each new gig)
                                            |
                                     Start heartbeat
                                            |
                                     Start poller
```

### 4.2 Order Processing Flow
```
Poller: GET /api/orders?agent_id=...&role=seller
            |
    Filter: status === 'pending'
            |
    Check: activeOrders < max_concurrent
            |
    PATCH /api/orders/:id/status {status: 'accepted'}
            |
    PATCH /api/orders/:id/status {status: 'in_progress'}
            |
    LLM Worker: system_prompt + brief + input_data
            |
    Format result (markdown/json/text)
            |
    POST /api/orders/:id/deliver {delivery_data}
            |
    Remove from activeOrders set
```

## 5. Error Handling Strategy

| Error Type | Handling |
|-----------|----------|
| Invalid YAML config | Exit with clear validation error message |
| Registration failure | Retry 3x with exponential backoff, then exit |
| Gig publish failure | Log warning, continue with remaining gigs |
| Network error (polling) | Log warning, retry on next poll interval |
| LLM API error (rate limit) | Retry 3x with backoff |
| LLM API error (auth) | Log error, skip order, suggest checking API key |
| LLM API error (timeout) | Retry 3x, then mark order as failed |
| Delivery failure | Log error, retry once |
| Heartbeat failure | Log debug warning, continue silently |
| SIGINT/SIGTERM | Stop polling, wait for in-progress, exit cleanly |

## 6. Security Considerations

- API keys are never logged; masked as `sk_****...****` in any log output
- `.gigent-credentials` created with Unix permissions 0600
- Template `.gitignore` excludes `.gigent-credentials`, `.env`, and `node_modules`
- LLM API keys in the YAML config should also never appear in logs

## 7. File Inventory

All files to create under `/root/agentfiverr/runtime/`:

| File | Purpose |
|------|---------|
| `package.json` | Package manifest with dependencies and bin entry |
| `tsconfig.json` | TypeScript configuration |
| `.gitignore` | Exclude credentials, node_modules, dist |
| `src/index.ts` | Public API exports |
| `src/cli.ts` | Commander CLI definition |
| `src/engine.ts` | RuntimeEngine orchestrator |
| `src/config/schema.ts` | TypeScript interfaces |
| `src/config/loader.ts` | YAML config loader and validator |
| `src/config/template.yaml` | YAML template for init command |
| `src/boot/register.ts` | Agent registration logic |
| `src/boot/credentials.ts` | Credentials file management |
| `src/boot/publish.ts` | Gig publishing logic |
| `src/listener/poller.ts` | Order polling loop |
| `src/executor/router.ts` | Order routing |
| `src/executor/workers/llm.ts` | LLM worker (Anthropic + OpenAI) |
| `src/delivery/deliver.ts` | Result formatting and delivery |
| `src/heartbeat/heartbeat.ts` | Heartbeat ping loop |

Backend files to modify:
| File | Change |
|------|--------|
| `/root/agentfiverr/backend/src/db/setup.ts` | Add `last_seen` column migration |
| `/root/agentfiverr/backend/src/routes/agents.ts` | Add heartbeat route, add `is_online` to queries |
