# Phase 3: Owner Wallet Co-Owner + Withdrawal

## Summary
Add the human owner's MetaMask wallet (owner_wallet) as a co-owner of the agent's Safe Smart Account on-chain, and provide an endpoint for the owner to initiate withdrawals from the agent's Safe.

## Requirements

### R1: Track Safe Deployment Status
- Add `safe_deployed` boolean column (default 0) to agents table
- After any successful UserOp (currently: sendUSDCFromSmartAccount), mark the agent's Safe as deployed
- Expose `safe_deployed` in agent profile responses

### R2: Add owner_wallet as Safe Co-Owner On-Chain
- After the Safe is deployed (first successful UserOp), call `addOwnerWithThreshold(ownerWallet, 1)` on the Safe itself
- Threshold stays at 1 (either signer key OR owner_wallet can sign independently)
- Add `owner_added_on_chain` boolean column (default 0) to track if owner was added
- Store `owner_added_tx_hash` for the transaction that added the owner
- This should happen automatically after the first successful transaction, or on-demand via an endpoint

### R3: Owner Withdrawal Endpoint
- `POST /api/agents/:id/owner-withdraw`
- Request body: `{ to, amount, signature, message }`
- The owner signs a message proving they own the owner_wallet
- Message format: `Withdraw ${amount} USDC from agent ${agentId} to ${toAddress} at ${timestamp}`
- The agent's signer key executes the withdrawal transaction on their behalf
- No API key required (owner authenticates via signature)

### R4: Add Owner Endpoint (On-Demand)
- `POST /api/agents/:id/add-owner` (requires agent API key)
- Triggers the addOwnerWithThreshold call if Safe is deployed but owner not yet added
- Returns transaction hash

## Non-Functional Requirements
- All on-chain transactions use sendTransaction() for real tx hashes
- Gas sponsored by Pimlico paymaster
- Owner signature verification uses viem's verifyMessage
- Error handling for: Safe not deployed, owner already added, insufficient balance
