/**
 * ContractsService — Interactions with Gigent on-chain contracts
 *
 * Uses viem to call AgentRegistry, PaymentEscrow, and ReviewSystem
 * from the platform's deployer wallet (onlyOwner).
 *
 * For buyer-side escrow (approve + createJob), builds calldata
 * for the buyer's smart account to execute.
 */

import {
  createWalletClient,
  http,
  type Address,
  type Hex,
  encodeFunctionData,
  keccak256,
  toBytes,
  parseUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { CHAIN, RPC_URL, USDC_ADDRESS, publicClient } from './wallet';
import { sendTransactionFromSmartAccount } from './smart-account';

// ─── Contract addresses (from env) ───

function getRegistryAddress(): Address {
  const addr = process.env.REGISTRY_CONTRACT;
  if (!addr) throw new Error('REGISTRY_CONTRACT not configured');
  return addr as Address;
}

function getEscrowAddress(): Address {
  const addr = process.env.ESCROW_CONTRACT;
  if (!addr) throw new Error('ESCROW_CONTRACT not configured');
  return addr as Address;
}

function getReviewAddress(): Address {
  const addr = process.env.REVIEW_CONTRACT;
  if (!addr) throw new Error('REVIEW_CONTRACT not configured');
  return addr as Address;
}

function getDeployerKey(): Hex {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) throw new Error('DEPLOYER_PRIVATE_KEY not configured');
  return key as Hex;
}

// ─── Check if on-chain contracts are configured ───

export function isOnChainEscrowEnabled(): boolean {
  return process.env.USE_ONCHAIN_ESCROW === 'true'
    && !!process.env.ESCROW_CONTRACT
    && !!process.env.DEPLOYER_PRIVATE_KEY;
}

export function isRegistryConfigured(): boolean {
  return !!process.env.REGISTRY_CONTRACT && !!process.env.DEPLOYER_PRIVATE_KEY;
}

export function isReviewContractConfigured(): boolean {
  return !!process.env.REVIEW_CONTRACT && !!process.env.DEPLOYER_PRIVATE_KEY;
}

// ─── Platform wallet client (deployer = owner of contracts) ───

function getPlatformWalletClient() {
  const account = privateKeyToAccount(getDeployerKey());
  return createWalletClient({
    account,
    chain: CHAIN,
    transport: http(RPC_URL),
  });
}

// ─── Convert UUID string to bytes32 (keccak256) ───

export function uuidToBytes32(uuid: string): Hex {
  return keccak256(toBytes(uuid));
}

// ─── ABIs (only the functions we call) ───

const AGENT_REGISTRY_ABI = [
  {
    name: 'registerAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'bytes32' },
      { name: 'wallet', type: 'address' },
      { name: 'ownerWallet', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'isRegistered',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const PAYMENT_ESCROW_ABI = [
  {
    name: 'createJob',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'jobId', type: 'bytes32' },
      { name: 'seller', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'releaseJob',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'refundJob',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'getJob',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'jobId', type: 'bytes32' }],
    outputs: [
      { name: 'buyer', type: 'address' },
      { name: 'seller', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'status', type: 'uint8' },
    ],
  },
] as const;

const REVIEW_SYSTEM_ABI = [
  {
    name: 'submitReview',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'jobId', type: 'bytes32' },
      { name: 'reviewer', type: 'address' },
      { name: 'reviewed', type: 'address' },
      { name: 'rating', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    name: 'getAverageRating',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [
      { name: 'sum', type: 'uint256' },
      { name: 'count', type: 'uint256' },
    ],
  },
] as const;

const USDC_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// ═══════════════════════════════════════════════════════════
//  AgentRegistry
// ═══════════════════════════════════════════════════════════

export async function registerAgentOnChain(
  agentId: string,
  walletAddress: string,
  ownerWallet: string,
): Promise<{ txHash: string }> {
  const client = getPlatformWalletClient();
  const agentIdBytes = uuidToBytes32(agentId);

  const txHash = await client.writeContract({
    address: getRegistryAddress(),
    abi: AGENT_REGISTRY_ABI,
    functionName: 'registerAgent',
    args: [agentIdBytes, walletAddress as Address, ownerWallet as Address],
  });

  console.log(`[Contract] AgentRegistry.registerAgent | agent=${agentId} | tx=${txHash}`);
  return { txHash };
}

// ═══════════════════════════════════════════════════════════
//  PaymentEscrow
// ═══════════════════════════════════════════════════════════

/**
 * Create escrow job from a Smart Account buyer.
 * Executes 2 calls via the buyer's Safe: approve + createJob.
 */
export async function createEscrowJobFromSmartAccount(
  buyerSignerKey: string,
  orderId: string,
  sellerWallet: string,
  amount: number,
): Promise<{ txHash: string }> {
  const escrowAddr = getEscrowAddress();
  const amountRaw = parseUnits(amount.toString(), 6);
  const jobId = uuidToBytes32(orderId);

  // Step 1: Approve escrow contract to spend buyer's USDC
  const approveData = encodeFunctionData({
    abi: USDC_APPROVE_ABI,
    functionName: 'approve',
    args: [escrowAddr, amountRaw],
  });

  const approveResult = await sendTransactionFromSmartAccount(
    buyerSignerKey,
    USDC_ADDRESS,
    approveData,
  );
  console.log(`[Contract] USDC.approve(escrow, ${amount}) | tx=${approveResult.txHash}`);

  // Step 2: Create the escrow job
  const createJobData = encodeFunctionData({
    abi: PAYMENT_ESCROW_ABI,
    functionName: 'createJob',
    args: [jobId, sellerWallet as Address, amountRaw],
  });

  const result = await sendTransactionFromSmartAccount(
    buyerSignerKey,
    escrowAddr,
    createJobData,
  );

  console.log(`[Contract] PaymentEscrow.createJob | order=${orderId} | tx=${result.txHash}`);
  return { txHash: result.txHash };
}

/**
 * Create escrow job from an EOA buyer.
 * The EOA signs approve + createJob directly.
 */
export async function createEscrowJobFromEOA(
  buyerPrivateKey: string,
  orderId: string,
  sellerWallet: string,
  amount: number,
): Promise<{ txHash: string }> {
  const escrowAddr = getEscrowAddress();
  const amountRaw = parseUnits(amount.toString(), 6);
  const jobId = uuidToBytes32(orderId);

  const account = privateKeyToAccount(buyerPrivateKey as Hex);
  const walletClient = createWalletClient({
    account,
    chain: CHAIN,
    transport: http(RPC_URL),
  });

  // Step 1: Approve
  await walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: USDC_APPROVE_ABI,
    functionName: 'approve',
    args: [escrowAddr, amountRaw],
  });

  // Step 2: Create job
  const txHash = await walletClient.writeContract({
    address: escrowAddr,
    abi: PAYMENT_ESCROW_ABI,
    functionName: 'createJob',
    args: [jobId, sellerWallet as Address, amountRaw],
  });

  console.log(`[Contract] PaymentEscrow.createJob (EOA) | order=${orderId} | tx=${txHash}`);
  return { txHash };
}

/**
 * Release escrowed funds to seller (platform signer).
 */
export async function releaseEscrowJob(orderId: string): Promise<{ txHash: string }> {
  const client = getPlatformWalletClient();
  const jobId = uuidToBytes32(orderId);

  const txHash = await client.writeContract({
    address: getEscrowAddress(),
    abi: PAYMENT_ESCROW_ABI,
    functionName: 'releaseJob',
    args: [jobId],
  });

  console.log(`[Contract] PaymentEscrow.releaseJob | order=${orderId} | tx=${txHash}`);
  return { txHash };
}

/**
 * Refund escrowed funds to buyer (platform signer).
 */
export async function refundEscrowJob(orderId: string): Promise<{ txHash: string }> {
  const client = getPlatformWalletClient();
  const jobId = uuidToBytes32(orderId);

  const txHash = await client.writeContract({
    address: getEscrowAddress(),
    abi: PAYMENT_ESCROW_ABI,
    functionName: 'refundJob',
    args: [jobId],
  });

  console.log(`[Contract] PaymentEscrow.refundJob | order=${orderId} | tx=${txHash}`);
  return { txHash };
}

// ═══════════════════════════════════════════════════════════
//  ReviewSystem
// ═══════════════════════════════════════════════════════════

export async function submitReviewOnChain(
  orderId: string,
  reviewerWallet: string,
  reviewedWallet: string,
  rating: number,
): Promise<{ txHash: string }> {
  const client = getPlatformWalletClient();
  const jobId = uuidToBytes32(orderId);

  const txHash = await client.writeContract({
    address: getReviewAddress(),
    abi: REVIEW_SYSTEM_ABI,
    functionName: 'submitReview',
    args: [jobId, reviewerWallet as Address, reviewedWallet as Address, rating],
  });

  console.log(`[Contract] ReviewSystem.submitReview | order=${orderId} rating=${rating} | tx=${txHash}`);
  return { txHash };
}
