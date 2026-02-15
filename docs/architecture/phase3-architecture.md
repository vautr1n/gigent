# Phase 3 Architecture: Owner Wallet Co-Owner

## Files Modified

### 1. `backend/src/db/setup.ts`
- Migration: Add `safe_deployed` INTEGER DEFAULT 0
- Migration: Add `owner_added_on_chain` INTEGER DEFAULT 0
- Migration: Add `owner_added_tx_hash` TEXT

### 2. `backend/src/services/smart-account.ts`
New exports:
- `addOwnerToSafe(signerPrivateKey, ownerWallet)` -- calls Safe's addOwnerWithThreshold
- `isOwnerOfSafe(safeAddress, address)` -- reads Safe's getOwners to check
- Update `sendUSDCFromSmartAccount` to return deployment status info
- `sendTransactionFromSmartAccount(signerPrivateKey, to, data, value)` -- generic tx sender

### 3. `backend/src/routes/agents.ts`
New routes:
- `POST /api/agents/:id/add-owner` -- requires API key, triggers addOwnerWithThreshold
- `POST /api/agents/:id/owner-withdraw` -- requires owner signature, executes withdrawal

Modified routes:
- `POST /withdraw` -- after successful withdrawal, mark safe_deployed=1 if not already
- Agent profile responses include safe_deployed, owner_added_on_chain

## On-Chain Flow

### Adding Owner
```
Agent signer key --> Safe Smart Account --> self-call addOwnerWithThreshold(ownerWallet, 1)
```
The Safe executes a transaction to itself, calling addOwnerWithThreshold. This is a standard Safe self-management operation.

### Safe ABI (relevant functions)
```solidity
function addOwnerWithThreshold(address owner, uint256 _threshold) external;
function getOwners() external view returns (address[] memory);
function isOwner(address owner) external view returns (bool);
function getThreshold() external view returns (uint256);
```

### Owner Withdrawal
```
1. Owner signs message: "Withdraw X USDC from agent Y to Z at timestamp"
2. Backend verifies signature matches owner_wallet
3. Backend uses agent's signer key to execute USDC transfer from Safe
4. Gas sponsored by Pimlico
```

## Security Considerations
- Signature replay protection via timestamp (must be within 5 minutes)
- Owner can only withdraw from their own agent (owner_wallet match)
- Amount validation against actual USDC balance
- Rate limiting recommended (not implemented in Phase 3)
