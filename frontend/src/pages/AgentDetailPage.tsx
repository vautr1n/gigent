import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Star, ShoppingCart, DollarSign, Clock,
  ExternalLink, Shield, Wallet, Calendar, Award, Copy, Check,
} from 'lucide-react';
import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import type { AgentDetail } from '../api/types';
import Badge, { statusVariant } from '../components/ui/Badge';
import StarRating from '../components/ui/StarRating';
import GigCard from '../components/cards/GigCard';
import ReviewCard from '../components/cards/ReviewCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorMessage from '../components/ui/ErrorMessage';
import EmptyState from '../components/ui/EmptyState';

interface ReputationData {
  agentId: number;
  agentName: string;
  onChain: boolean;
  feedbackCount: number;
  averageScore: number | null;
  registry: string;
  chain: string;
}

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: agent, loading, error, refetch } = useFetch<AgentDetail>(`/agents/${id}`);
  const reputationEndpoint = agent?.name ? `/reputation/${encodeURIComponent(agent.name)}` : null;
  const { data: reputation } = useFetch<ReputationData>(reputationEndpoint);
  const [copied, setCopied] = useState(false);

  if (loading) return <LoadingSpinner text="Loading agent profile..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!agent) return <ErrorMessage message="Agent not found" />;

  const tags = parseTags(agent.tags);

  const handleCopyWallet = (e: React.MouseEvent) => {
    e.preventDefault();
    if (agent.wallet_address) {
      navigator.clipboard.writeText(agent.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Back link */}
      <Link
        to="/agents"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to agents
      </Link>

      {/* Profile Header */}
      <div className="glass-card p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-ember text-white flex items-center justify-center text-3xl font-bold ring-4 ring-border shrink-0">
            {agent.avatar_url ? (
              <img
                src={agent.avatar_url}
                alt={agent.name}
                className="w-full h-full rounded-2xl object-cover"
              />
            ) : (
              agent.name.charAt(0).toUpperCase()
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-ink mb-1">{agent.name}</h1>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Badge>{agent.category}</Badge>
                  <Badge variant={statusVariant(agent.status)}>{agent.status}</Badge>
                  {agent.account_type === 'smart_account' && (
                    <Badge variant="info">
                      <Shield className="w-3 h-3 mr-1" />
                      Smart Account
                    </Badge>
                  )}
                  {agent.erc8004_id && (
                    <Badge variant="purple">
                      <Shield className="w-3 h-3 mr-1" />
                      ERC-8004 #{agent.erc8004_id}
                    </Badge>
                  )}
                </div>
              </div>
              <StarRating rating={agent.rating_avg} count={agent.rating_count} size="md" />
            </div>

            <p className="text-sm text-ink-muted leading-relaxed mb-4">
              {agent.description}
            </p>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {tags.map((tag) => (
                  <span key={tag} className="text-xs text-ink-muted bg-sand-deep px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Wallet + Meta */}
            <div className="flex items-center gap-4 text-xs text-ink-muted flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Joined {formatDate(agent.created_at)}
              </span>
              {agent.wallet_address && (
                <div className="flex items-center gap-1">
                  <a
                    href={`https://basescan.org/address/${agent.wallet_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-ember transition-colors font-mono bg-sand-deep px-2 py-0.5 rounded"
                  >
                    <Wallet className="w-3 h-3" />
                    {agent.wallet_address}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    onClick={handleCopyWallet}
                    className="p-1 rounded hover:bg-sand-deep transition-colors"
                    title="Copy wallet address"
                  >
                    {copied ? <Check className="w-3 h-3 text-sage" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6 pt-6 border-t border-border">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star className="w-4 h-4 text-signal" />
              <span className="text-xl font-bold text-ink">
                {agent.rating_avg > 0 ? agent.rating_avg.toFixed(1) : '--'}
              </span>
            </div>
            <span className="text-xs text-ink-muted">Rating ({agent.rating_count})</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Shield className="w-4 h-4 text-info" />
              <span className="text-xl font-bold text-ink">
                {reputation?.averageScore != null ? reputation.averageScore.toFixed(0) : '--'}
              </span>
            </div>
            <span className="text-xs text-ink-muted">
              ERC-8004 Score{reputation?.feedbackCount ? ` (${reputation.feedbackCount})` : ''}
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <ShoppingCart className="w-4 h-4 text-ember" />
              <span className="text-xl font-bold text-ink">
                {agent.total_orders_completed}
              </span>
            </div>
            <span className="text-xs text-ink-muted">Orders Done</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <DollarSign className="w-4 h-4 text-sage" />
              <span className="text-xl font-bold text-ink">
                ${agent.total_earnings.toFixed(0)}
              </span>
            </div>
            <span className="text-xs text-ink-muted">Total Earned</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className="w-4 h-4 text-info" />
              <span className="text-xl font-bold text-ink">
                {agent.response_time_avg > 0 ? `${agent.response_time_avg}s` : '--'}
              </span>
            </div>
            <span className="text-xs text-ink-muted">Avg Response</span>
          </div>
        </div>
      </div>

      {/* On-Chain Reputation Card */}
      {agent.erc8004_id && (
        <div className="glass-card p-5 mb-8 border-info/20">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-info-light flex items-center justify-center">
                <Shield className="w-5 h-5 text-info" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">On-Chain Reputation (ERC-8004)</h3>
                <p className="text-xs text-ink-muted">
                  Verified on Base -- immutable and portable across platforms
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {reputation?.averageScore != null && (
                <div className="text-center">
                  <span className="text-2xl font-bold text-info">{reputation.averageScore.toFixed(0)}</span>
                  <span className="text-xs text-ink-muted ml-1">/100</span>
                </div>
              )}
              {reputation?.feedbackCount != null && reputation.feedbackCount > 0 && (
                <div className="text-center">
                  <span className="text-lg font-bold text-ink">{reputation.feedbackCount}</span>
                  <span className="text-xs text-ink-muted ml-1">reviews</span>
                </div>
              )}
              <a
                href={`https://basescan.org/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-info hover:text-info flex items-center gap-1 transition-colors"
              >
                View contract
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Active Gigs */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-ink mb-4">
          Active Gigs ({agent.gigs?.length || 0})
        </h2>
        {agent.gigs && agent.gigs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agent.gigs.map((gig) => (
              <GigCard key={gig.id} gig={{ ...gig, agent_name: agent.name }} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No active gigs"
            message="This agent doesn't have any active gigs right now."
          />
        )}
      </section>

      {/* Reviews */}
      <section>
        <h2 className="text-xl font-bold text-ink mb-4">
          Reviews ({agent.reviews?.length || 0})
        </h2>
        {agent.reviews && agent.reviews.length > 0 ? (
          <div className="space-y-3">
            {agent.reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No reviews yet"
            message="This agent hasn't received any reviews."
          />
        )}
      </section>
    </div>
  );
}

function parseTags(tags: string): string[] {
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}
