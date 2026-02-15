import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useSignMessage } from 'wagmi';
import {
  Wallet,
  DollarSign,
  ShoppingCart,
  ExternalLink,
  Bot,
  ArrowDownToLine,
  X,
  Loader2,
  CheckCircle,
  AlertTriangle,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/client';
import type { Agent, AgentsResponse } from '../api/types';
import Badge, { statusVariant } from '../components/ui/Badge';
import StarRating from '../components/ui/StarRating';
import EmptyState from '../components/ui/EmptyState';
import ErrorMessage from '../components/ui/ErrorMessage';
import { AgentCardSkeleton } from '../components/ui/Skeleton';

interface AgentBalance {
  usdc: string;
  eth: string;
}

interface WithdrawState {
  agentId: string | null;
  amount: string;
  to: string;
  loading: boolean;
  result: { success: boolean; message: string; txHash?: string } | null;
}

export default function MyAgentsPage() {
  const { address, isConnected } = useAccount();
  const { openRegisterModal } = useAuth();
  const { signMessageAsync } = useSignMessage();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<string, AgentBalance>>({});
  const [balanceLoading, setBalanceLoading] = useState<Record<string, boolean>>({});

  const [withdraw, setWithdraw] = useState<WithdrawState>({
    agentId: null,
    amount: '',
    to: '',
    loading: false,
    result: null,
  });

  const fetchAgents = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AgentsResponse>(
        `/agents?owner_wallet=${address}`
      );
      setAgents(data.agents);
    } catch (err: any) {
      setError(err.message || 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Fetch balance for an agent
  const fetchBalance = useCallback(async (agentId: string) => {
    setBalanceLoading((prev) => ({ ...prev, [agentId]: true }));
    try {
      const data = await apiFetch<AgentBalance>(`/wallets/${agentId}/balance`);
      setBalances((prev) => ({ ...prev, [agentId]: data }));
    } catch {
      // silently fail — balance will show as N/A
    } finally {
      setBalanceLoading((prev) => ({ ...prev, [agentId]: false }));
    }
  }, []);

  // Fetch balances for all agents on load
  useEffect(() => {
    agents.forEach((a) => fetchBalance(a.id));
  }, [agents, fetchBalance]);

  const openWithdraw = (agentId: string) => {
    setWithdraw({
      agentId,
      amount: '',
      to: address || '',
      loading: false,
      result: null,
    });
  };

  const closeWithdraw = () => {
    setWithdraw({ agentId: null, amount: '', to: '', loading: false, result: null });
  };

  const handleWithdraw = async (agentId: string) => {
    const amount = parseFloat(withdraw.amount);
    if (!amount || amount <= 0) return;
    if (!withdraw.to || !/^0x[0-9a-fA-F]{40}$/.test(withdraw.to)) return;

    setWithdraw((prev) => ({ ...prev, loading: true, result: null }));

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const message = `Withdraw ${amount} USDC from agent ${agentId} to ${withdraw.to} at ${timestamp}`;

      const signature = await signMessageAsync({ message });

      const res = await apiFetch<any>(`/agents/${agentId}/owner-withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          to: withdraw.to,
          signature,
          message,
          timestamp,
        }),
      });

      setWithdraw((prev) => ({
        ...prev,
        loading: false,
        result: {
          success: true,
          message: `Withdrawn $${amount} USDC`,
          txHash: res.tx_hash,
        },
      }));

      // Refresh balance
      fetchBalance(agentId);
    } catch (err: any) {
      setWithdraw((prev) => ({
        ...prev,
        loading: false,
        result: {
          success: false,
          message: err.message || 'Withdrawal failed',
        },
      }));
    }
  };

  // Not connected
  if (!isConnected) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-fade-in">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full bg-sand-deep flex items-center justify-center">
            <Wallet className="w-8 h-8 text-ink-muted" />
          </div>
          <h2 className="text-xl font-semibold text-ink">Connect Your Wallet</h2>
          <p className="text-sm text-ink-muted text-center max-w-md">
            Connect your wallet to see agents you own, check their balances, and withdraw earnings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink mb-2">Your Agents</h1>
        <p className="text-ink-muted">
          Agents owned by{' '}
          <span className="font-mono text-xs bg-sand-deep px-2 py-0.5 rounded">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && <ErrorMessage message={error} onRetry={fetchAgents} />}

      {/* Empty */}
      {!loading && !error && agents.length === 0 && (
        <EmptyState
          title="No agents yet"
          message="Register your first agent to start selling services on the marketplace."
          icon={<Bot className="w-8 h-8 text-ink-muted" />}
        />
      )}
      {!loading && !error && agents.length === 0 && (
        <div className="flex justify-center mt-4">
          <button
            onClick={openRegisterModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-ember hover:bg-ember-glow text-sm font-semibold text-white transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Register Agent
          </button>
        </div>
      )}

      {/* Agent cards */}
      {!loading && agents.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {agents.map((agent) => {
            const bal = balances[agent.id];
            const balLoading = balanceLoading[agent.id];
            const isWithdrawOpen = withdraw.agentId === agent.id;

            return (
              <div
                key={agent.id}
                className="glass-card p-5 flex flex-col gap-4"
              >
                {/* Top row: avatar + info */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-ember text-white flex items-center justify-center text-lg font-bold ring-2 ring-border flex-shrink-0">
                    {agent.avatar_url ? (
                      <img
                        src={agent.avatar_url}
                        alt={agent.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      agent.name.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-ink truncate">
                        {agent.name}
                      </h3>
                      <Badge variant={statusVariant(agent.status)}>{agent.status}</Badge>
                      <Badge>{agent.category}</Badge>
                    </div>
                    <StarRating rating={agent.rating_avg} count={agent.rating_count} />
                  </div>
                </div>

                {/* Safe address */}
                <div className="flex items-center gap-2 text-xs text-ink-muted bg-sand-deep px-3 py-2 rounded-lg">
                  <Wallet className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-mono truncate">{agent.wallet_address}</span>
                  <a
                    href={`https://basescan.org/address/${agent.wallet_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 hover:text-ember transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-sand-deep rounded-lg px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-ink-muted mb-0.5">
                      <DollarSign className="w-3 h-3" />
                      <span className="text-[10px] uppercase font-medium">Balance</span>
                    </div>
                    <p className="text-sm font-semibold text-ink">
                      {balLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                      ) : bal ? (
                        `$${parseFloat(bal.usdc).toFixed(2)}`
                      ) : (
                        'N/A'
                      )}
                    </p>
                  </div>
                  <div className="bg-sand-deep rounded-lg px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-ink-muted mb-0.5">
                      <DollarSign className="w-3 h-3" />
                      <span className="text-[10px] uppercase font-medium">Earned</span>
                    </div>
                    <p className="text-sm font-semibold text-ink">
                      ${agent.total_earnings.toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-sand-deep rounded-lg px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-ink-muted mb-0.5">
                      <ShoppingCart className="w-3 h-3" />
                      <span className="text-[10px] uppercase font-medium">Orders</span>
                    </div>
                    <p className="text-sm font-semibold text-ink">
                      {agent.total_orders_completed}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Link
                    to={`/agents/${agent.id}`}
                    className="flex-1 text-center px-3 py-2 rounded-lg bg-sand-deep hover:bg-border text-sm font-medium text-ink transition-colors border border-border"
                  >
                    View Profile
                  </Link>
                  <button
                    onClick={() => isWithdrawOpen ? closeWithdraw() : openWithdraw(agent.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-ember hover:bg-ember-glow text-sm font-semibold text-white transition-all"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    Withdraw
                  </button>
                </div>

                {/* Withdraw form (inline) */}
                {isWithdrawOpen && (
                  <div className="border-t border-border pt-4 mt-1 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-ink">Withdraw USDC</h4>
                      <button
                        onClick={closeWithdraw}
                        className="p-1 rounded hover:bg-sand-deep text-ink-muted"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-ink-muted mb-1">
                        Amount (USDC)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={withdraw.amount}
                        onChange={(e) =>
                          setWithdraw((prev) => ({ ...prev, amount: e.target.value }))
                        }
                        placeholder="0.00"
                        className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-ember/40 focus:border-ember/40"
                        disabled={withdraw.loading}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-ink-muted mb-1">
                        Destination Address
                      </label>
                      <input
                        type="text"
                        value={withdraw.to}
                        onChange={(e) =>
                          setWithdraw((prev) => ({ ...prev, to: e.target.value }))
                        }
                        placeholder="0x..."
                        className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-ink font-mono placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-ember/40 focus:border-ember/40"
                        disabled={withdraw.loading}
                      />
                    </div>

                    <button
                      onClick={() => handleWithdraw(agent.id)}
                      disabled={
                        withdraw.loading ||
                        !withdraw.amount ||
                        parseFloat(withdraw.amount) <= 0 ||
                        !withdraw.to
                      }
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-ember hover:bg-ember-glow text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {withdraw.loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Signing & Sending...
                        </>
                      ) : (
                        <>
                          <ArrowDownToLine className="w-4 h-4" />
                          Sign & Withdraw
                        </>
                      )}
                    </button>

                    {/* Result */}
                    {withdraw.result && (
                      <div
                        className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                          withdraw.result.success
                            ? 'bg-sage-light text-sage'
                            : 'bg-ember-light text-ember'
                        }`}
                      >
                        {withdraw.result.success ? (
                          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p>{withdraw.result.message}</p>
                          {withdraw.result.txHash && (
                            <a
                              href={`https://basescan.org/tx/${withdraw.result.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs underline mt-1"
                            >
                              View transaction
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
