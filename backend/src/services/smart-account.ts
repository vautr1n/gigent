/**
 * SmartAccountService — Safe Smart Accounts (ERC-4337) with Pimlico Paymaster
 *
 * Creates Safe v1.4.1 smart accounts for agents and sends USDC via UserOps
 * with sponsored gas (no ETH needed). Uses sendTransaction() to return
 * real tx hashes compatible with BaseScan.
 *
 * Phase 3: Adds owner wallet management (addOwnerWithThreshold, isOwner checks)
 */

import { type Hex, type Address, encodeFunctionData, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from 'permissionless';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { entryPoint07Address } from 'viem/account-abstraction';
import { IS_MAINNET, CHAIN, publicClient, USDC_ADDRESS, USDC_ABI } from './wallet';
import { http } from 'viem';

// ─── Safe v1.4.1 ABI (owner management + query functions) ───

const SAFE_ABI = [
  {
    name: 'addOwnerWithThreshold',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: '_threshold', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'getOwners',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'isOwner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getThreshold',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// ─── Pimlico config (read at runtime so dotenv has loaded) ───

function getPimlicoUrl(): string {
  const key = process.env.PIMLICO_API_KEY || '';
  const slug = IS_MAINNET ? 'base' : 'base-sepolia';
  return `https://api.pimlico.io/v2/${slug}/rpc?apikey=${key}`;
}

export function isPimlicoConfigured(): boolean {
  return (process.env.PIMLICO_API_KEY || '').length > 0;
}

// ─── Build a Safe Smart Account object (reusable helper) ───

async function buildSafeAccount(signerPrivateKey: string) {
  const signer = privateKeyToAccount(signerPrivateKey as Hex);

  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [signer],
    version: '1.4.1',
    entryPoint: { address: entryPoint07Address, version: '0.7' },
    saltNonce: 0n,
  });

  return { signer, safeAccount };
}

// ─── Build a Smart Account Client with Pimlico paymaster (reusable helper) ───

async function buildSmartAccountClient(signerPrivateKey: string) {
  if (!isPimlicoConfigured()) {
    throw new Error('PIMLICO_API_KEY not configured — cannot send from Smart Account');
  }

  const { signer, safeAccount } = await buildSafeAccount(signerPrivateKey);
  const bundlerUrl = getPimlicoUrl();

  const pimlicoClient = createPimlicoClient({
    transport: http(bundlerUrl),
    entryPoint: { address: entryPoint07Address, version: '0.7' },
  });

  const smartAccountClient = createSmartAccountClient({
    account: safeAccount,
    chain: CHAIN,
    bundlerTransport: http(bundlerUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        return (await pimlicoClient.getUserOperationGasPrice()).fast;
      },
    },
  });

  return { signer, safeAccount, smartAccountClient, pimlicoClient };
}

// ─── Create a Safe Smart Account (counterfactual — no gas needed) ───

export async function createSmartAccount(signerPrivateKey: string): Promise<{ address: string; signerAddress: string }> {
  const { signer, safeAccount } = await buildSafeAccount(signerPrivateKey);

  return {
    address: safeAccount.address,
    signerAddress: signer.address,
  };
}

// ─── Check if Safe is deployed on-chain ───

export async function isSafeDeployed(safeAddress: string): Promise<boolean> {
  const code = await publicClient.getCode({ address: safeAddress as Address });
  return code !== undefined && code !== '0x';
}

// ─── Check if an address is already an owner of the Safe ───

export async function isOwnerOfSafe(safeAddress: string, ownerAddress: string): Promise<boolean> {
  try {
    const result = await publicClient.readContract({
      address: safeAddress as Address,
      abi: SAFE_ABI,
      functionName: 'isOwner',
      args: [ownerAddress as Address],
    });
    return result as boolean;
  } catch (e: any) {
    // If the Safe is not deployed yet, readContract will fail
    console.log(`Could not check isOwner for ${safeAddress}: ${e.message}`);
    return false;
  }
}

// ─── Get all owners of a Safe ───

export async function getSafeOwners(safeAddress: string): Promise<string[]> {
  try {
    const result = await publicClient.readContract({
      address: safeAddress as Address,
      abi: SAFE_ABI,
      functionName: 'getOwners',
    });
    return result as string[];
  } catch (e: any) {
    console.log(`Could not get owners for ${safeAddress}: ${e.message}`);
    return [];
  }
}

// ─── Get Safe threshold ───

export async function getSafeThreshold(safeAddress: string): Promise<number> {
  try {
    const result = await publicClient.readContract({
      address: safeAddress as Address,
      abi: SAFE_ABI,
      functionName: 'getThreshold',
    });
    return Number(result);
  } catch (e: any) {
    console.log(`Could not get threshold for ${safeAddress}: ${e.message}`);
    return 0;
  }
}

// ─── Add owner_wallet as co-owner of the Safe (threshold stays at 1) ───

export async function addOwnerToSafe(
  signerPrivateKey: string,
  ownerWallet: string,
): Promise<{ txHash: string; safeAddress: string; newOwner: string }> {
  const { safeAccount, smartAccountClient } = await buildSmartAccountClient(signerPrivateKey);

  // Check if Safe is deployed
  const deployed = await isSafeDeployed(safeAccount.address);
  if (!deployed) {
    throw new Error('Safe is not deployed yet. Send a transaction first to deploy it.');
  }

  // Check if owner is already added
  const alreadyOwner = await isOwnerOfSafe(safeAccount.address, ownerWallet);
  if (alreadyOwner) {
    throw new Error(`${ownerWallet} is already an owner of Safe ${safeAccount.address}`);
  }

  // Encode addOwnerWithThreshold(ownerWallet, 1)
  // The Safe calls itself to add a new owner
  const calldata = encodeFunctionData({
    abi: SAFE_ABI,
    functionName: 'addOwnerWithThreshold',
    args: [ownerWallet as Address, 1n],
  });

  // Send transaction: Safe calls itself
  const txHash = await smartAccountClient.sendTransaction({
    to: safeAccount.address,
    data: calldata,
    value: 0n,
  });

  console.log(`[Safe] Added owner ${ownerWallet} to Safe ${safeAccount.address} | tx: ${txHash}`);

  return {
    txHash,
    safeAddress: safeAccount.address,
    newOwner: ownerWallet,
  };
}

// ─── Send USDC from a Smart Account (gas sponsored by Pimlico) ───

export async function sendUSDCFromSmartAccount(
  signerPrivateKey: string,
  toAddress: string,
  amount: number,
): Promise<{ txHash: string; from: string; to: string; amount: string }> {
  const { safeAccount, smartAccountClient } = await buildSmartAccountClient(signerPrivateKey);

  const amountRaw = parseUnits(amount.toString(), 6);

  const calldata = encodeFunctionData({
    abi: USDC_ABI,
    functionName: 'transfer',
    args: [toAddress as Address, amountRaw],
  });

  // sendTransaction returns a real tx hash (not a UserOp hash)
  // Compatible with BaseScan links
  const txHash = await smartAccountClient.sendTransaction({
    to: USDC_ADDRESS,
    data: calldata,
    value: 0n,
  });

  return {
    txHash,
    from: safeAccount.address,
    to: toAddress,
    amount: amount.toString(),
  };
}

// ─── Send arbitrary transaction from a Smart Account (gas sponsored) ───

export async function sendTransactionFromSmartAccount(
  signerPrivateKey: string,
  to: string,
  data: Hex,
  value: bigint = 0n,
): Promise<{ txHash: string; from: string }> {
  const { safeAccount, smartAccountClient } = await buildSmartAccountClient(signerPrivateKey);

  const txHash = await smartAccountClient.sendTransaction({
    to: to as Address,
    data,
    value,
  });

  return {
    txHash,
    from: safeAccount.address,
  };
}
