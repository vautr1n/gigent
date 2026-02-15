/**
 * WalletService — Generates and manages Base wallets
 * With balance caching to avoid RPC rate limits
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

// ─── Config ───

export const IS_MAINNET = process.env.CHAIN === 'base';
export const CHAIN = IS_MAINNET ? base : baseSepolia;
export const RPC_URL = IS_MAINNET
  ? (process.env.BASE_RPC_URL || 'https://mainnet.base.org')
  : (process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org');

export const USDC_ADDRESS: Address = IS_MAINNET
  ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
  : '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

export const USDC_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
] as const;

export const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });

// ─── Balance cache (60s TTL) ───
const balanceCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 60_000;

// ─── Generate wallet ───

export function generateWallet(): { address: string; privateKey: string } {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { address: account.address, privateKey };
}

// ─── Get balance (with cache + retry) ───

async function fetchBalanceWithRetry(addr: Address, retries = 2): Promise<{ eth: bigint; usdc: bigint }> {
  for (let i = 0; i <= retries; i++) {
    try {
      const [ethRaw, usdcRaw] = await Promise.all([
        publicClient.getBalance({ address: addr }),
        publicClient.readContract({
          address: USDC_ADDRESS, abi: USDC_ABI,
          functionName: 'balanceOf', args: [addr],
        }) as Promise<bigint>,
      ]);
      return { eth: ethRaw, usdc: usdcRaw };
    } catch (e: any) {
      if (i < retries && (e.message?.includes('429') || e.message?.includes('rate limit'))) {
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error('RPC failed after retries');
}

export async function getBalance(address: string) {
  const cached = balanceCache.get(address);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const addr = address as Address;
  try {
    const { eth: ethRaw, usdc: usdcRaw } = await fetchBalanceWithRetry(addr);
    const result = {
      wallet_address: address,
      eth: formatUnits(ethRaw, 18),
      usdc: formatUnits(usdcRaw, 6),
      chain: CHAIN.name,
      explorer: explorerUrl(address, 'address'),
    };
    balanceCache.set(address, { data: result, ts: Date.now() });
    return result;
  } catch (e: any) {
    // Return cached even if expired, or zeros
    if (cached) return cached.data;
    return {
      wallet_address: address,
      eth: '0', usdc: '0',
      chain: CHAIN.name,
      explorer: explorerUrl(address, 'address'),
    };
  }
}

// ─── Send USDC ───

export async function sendUSDC(fromPrivateKey: string, toAddress: string, amount: number) {
  const account = privateKeyToAccount(fromPrivateKey as Hex);
  const walletClient = createWalletClient({ account, chain: CHAIN, transport: http(RPC_URL) });
  const amountRaw = parseUnits(amount.toString(), 6);

  const txHash = await walletClient.writeContract({
    address: USDC_ADDRESS, abi: USDC_ABI,
    functionName: 'transfer', args: [toAddress as Address, amountRaw],
  });

  // Invalidate cache
  balanceCache.delete(account.address);
  balanceCache.delete(toAddress);

  return { txHash, from: account.address, to: toAddress, amount: amount.toString(), explorer: explorerUrl(txHash, 'tx') };
}

// ─── Explorer URL ───

export function explorerUrl(hash: string, type: 'tx' | 'address' = 'tx'): string {
  const base = IS_MAINNET ? 'https://basescan.org' : 'https://sepolia.basescan.org';
  return `${base}/${type}/${hash}`;
}

// ─── Chain info ───

export function getChainInfo() {
  return { chain: CHAIN.name, chainId: CHAIN.id, rpc: RPC_URL, usdc: USDC_ADDRESS,
    explorer: IS_MAINNET ? 'https://basescan.org' : 'https://sepolia.basescan.org' };
}
