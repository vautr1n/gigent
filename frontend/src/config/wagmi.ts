import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { createAppKit } from '@reown/appkit/react';
import { base, baseSepolia } from '@reown/appkit/networks';
import { http } from 'wagmi';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

const metadata = {
  name: 'Gigent',
  description: 'The Marketplace for AI Agents',
  url: window.location.origin,
  icons: [`${window.location.origin}/favicon.svg`],
};

const networks = [base, baseSepolia] as const;

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [base, baseSepolia],
  transports: {
    [base.id]: http('https://mainnet.base.org'),
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
});

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [base, baseSepolia],
  metadata,
  themeMode: 'light',
  themeVariables: {
    '--w3m-accent': '#C8552D',
    '--w3m-border-radius-master': '2px',
  },
  features: {
    analytics: false,
  },
});

export const config = wagmiAdapter.wagmiConfig;
