import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import type { Agent } from '../api/types';

interface AuthState {
  agent: Agent | null;
  apiKey: string | null;
  isRegistered: boolean;
  isLoading: boolean;
  showRegisterModal: boolean;
}

interface AuthContextValue extends AuthState {
  walletAddress: string | undefined;
  isConnected: boolean;
  register: (data: RegisterData) => Promise<RegisterResult>;
  logout: () => void;
  openRegisterModal: () => void;
  closeRegisterModal: () => void;
  refreshAgent: () => Promise<void>;
}

interface RegisterData {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  avatar_url?: string;
}

interface RegisterResult {
  success: boolean;
  agent?: Agent;
  apiKey?: string;
  error?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY_PREFIX = 'gigent_';

function getStoredAuth(walletAddress: string): { agentId: string; apiKey: string } | null {
  try {
    const key = `${STORAGE_KEY_PREFIX}${walletAddress.toLowerCase()}`;
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return null;
}

function storeAuth(walletAddress: string, agentId: string, apiKey: string) {
  const key = `${STORAGE_KEY_PREFIX}${walletAddress.toLowerCase()}`;
  localStorage.setItem(key, JSON.stringify({ agentId, apiKey }));
}

function clearAuth(walletAddress: string) {
  const key = `${STORAGE_KEY_PREFIX}${walletAddress.toLowerCase()}`;
  localStorage.removeItem(key);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const [state, setState] = useState<AuthState>({
    agent: null,
    apiKey: null,
    isRegistered: false,
    isLoading: false,
    showRegisterModal: false,
  });

  // When wallet connects, check if agent is already registered
  const loadAgent = useCallback(async (walletAddress: string) => {
    const stored = getStoredAuth(walletAddress);
    if (!stored) {
      setState(prev => ({ ...prev, agent: null, apiKey: null, isRegistered: false, isLoading: false }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const res = await fetch(`/api/agents/${stored.agentId}`);
      if (res.ok) {
        const agent = await res.json();
        setState(prev => ({
          ...prev,
          agent,
          apiKey: stored.apiKey,
          isRegistered: true,
          isLoading: false,
        }));
      } else {
        // Agent not found, clear stale data
        clearAuth(walletAddress);
        setState(prev => ({ ...prev, agent: null, apiKey: null, isRegistered: false, isLoading: false }));
      }
    } catch {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    if (isConnected && address) {
      loadAgent(address);
    } else {
      setState({ agent: null, apiKey: null, isRegistered: false, isLoading: false, showRegisterModal: false });
    }
  }, [isConnected, address, loadAgent]);

  const register = useCallback(async (data: RegisterData): Promise<RegisterResult> => {
    if (!address) return { success: false, error: 'Wallet not connected' };

    try {
      const res = await fetch('/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          owner_wallet: address,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { success: false, error: body.error || `Registration failed (${res.status})` };
      }

      const result = await res.json();
      const apiKey = result.api_key;
      const agentId = result.id;

      // Store auth
      storeAuth(address, agentId, apiKey);

      // Load agent profile
      const agentRes = await fetch(`/api/agents/${agentId}`);
      const agent = agentRes.ok ? await agentRes.json() : result;

      setState(prev => ({
        ...prev,
        agent,
        apiKey,
        isRegistered: true,
        showRegisterModal: false,
      }));

      return { success: true, agent, apiKey };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  }, [address]);

  const refreshAgent = useCallback(async () => {
    if (address) await loadAgent(address);
  }, [address, loadAgent]);

  const logout = useCallback(() => {
    if (address) clearAuth(address);
    setState({ agent: null, apiKey: null, isRegistered: false, isLoading: false, showRegisterModal: false });
    disconnect();
  }, [address, disconnect]);

  const openRegisterModal = useCallback(() => {
    setState(prev => ({ ...prev, showRegisterModal: true }));
  }, []);

  const closeRegisterModal = useCallback(() => {
    setState(prev => ({ ...prev, showRegisterModal: false }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        walletAddress: address,
        isConnected,
        register,
        logout,
        openRegisterModal,
        closeRegisterModal,
        refreshAgent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
