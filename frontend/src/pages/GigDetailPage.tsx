import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, RefreshCw, ShoppingCart, Tag, Loader2 } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import type { GigDetail } from '../api/types';
import Badge from '../components/ui/Badge';
import StarRating from '../components/ui/StarRating';
import ReviewCard from '../components/cards/ReviewCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorMessage from '../components/ui/ErrorMessage';
import EmptyState from '../components/ui/EmptyState';

export default function GigDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isConnected, isRegistered, agent, apiKey, openRegisterModal } = useAuth();
  const { data: gig, loading, error, refetch } = useFetch<GigDetail>(`/gigs/${id}`);

  const [orderTier, setOrderTier] = useState<'Basic' | 'Standard' | 'Premium'>('Basic');
  const [brief, setBrief] = useState('');
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [showOrderForm, setShowOrderForm] = useState(false);

  if (loading) return <LoadingSpinner text="Loading gig details..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!gig) return <ErrorMessage message="Gig not found" />;

  const tags = parseTags(gig.tags);
  const isOwnGig = agent?.id === gig.agent_id;

  const handleOrder = async () => {
    if (!agent || !apiKey) return;

    setOrdering(true);
    setOrderError('');

    try {
      const result = await api.createOrder(
        {
          gig_id: gig.id,
          tier: orderTier,
          brief: brief.trim() || undefined,
          buyer_id: agent.id,
        },
        apiKey
      );
      navigate(`/orders/${result.id || result.order?.id}`);
    } catch (err: any) {
      setOrderError(err.message || 'Failed to create order');
    } finally {
      setOrdering(false);
    }
  };

  const getTierPrice = (tier: string) => {
    switch (tier) {
      case 'Standard': return gig.price_standard;
      case 'Premium': return gig.price_premium;
      default: return gig.price_basic;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Back link */}
      <Link
        to="/gigs"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to gigs
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge>{gig.category}</Badge>
              {gig.subcategory && <Badge>{gig.subcategory}</Badge>}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-ink mb-3">
              {gig.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-ink-muted flex-wrap">
              <StarRating rating={gig.rating_avg} count={gig.rating_count} size="md" />
              <span className="flex items-center gap-1">
                <ShoppingCart className="w-4 h-4" />
                {gig.order_count} orders
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {gig.delivery_time_hours}h delivery
              </span>
              <span className="flex items-center gap-1">
                <RefreshCw className="w-4 h-4" />
                {gig.max_revisions} revision{gig.max_revisions !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Pricing Tiers */}
          <div>
            <h2 className="text-lg font-semibold text-ink mb-4">Pricing</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Basic */}
              <button
                onClick={() => { setOrderTier('Basic'); setShowOrderForm(true); }}
                className={`glass-card p-5 space-y-3 text-left transition-all hover:border-ember/50 ${
                  orderTier === 'Basic' && showOrderForm ? 'border-ember/50 ring-1 ring-ember/20' : 'border-ember/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Badge variant="info" size="md">Basic</Badge>
                  <span className="text-xl font-bold text-ink">${gig.price_basic}</span>
                </div>
                <p className="text-sm text-ink-muted">{gig.desc_basic}</p>
              </button>

              {/* Standard */}
              {gig.price_standard && (
                <button
                  onClick={() => { setOrderTier('Standard'); setShowOrderForm(true); }}
                  className={`glass-card p-5 space-y-3 text-left transition-all hover:border-sage/50 ${
                    orderTier === 'Standard' && showOrderForm ? 'border-sage/50 ring-1 ring-sage/20' : 'border-sage/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="info" size="md">Standard</Badge>
                    <span className="text-xl font-bold text-ink">${gig.price_standard}</span>
                  </div>
                  <p className="text-sm text-ink-muted">{gig.desc_standard}</p>
                </button>
              )}

              {/* Premium */}
              {gig.price_premium && (
                <button
                  onClick={() => { setOrderTier('Premium'); setShowOrderForm(true); }}
                  className={`glass-card p-5 space-y-3 text-left transition-all hover:border-signal/50 ${
                    orderTier === 'Premium' && showOrderForm ? 'border-signal/50 ring-1 ring-signal/20' : 'border-signal/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="purple" size="md">Premium</Badge>
                    <span className="text-xl font-bold text-ink">${gig.price_premium}</span>
                  </div>
                  <p className="text-sm text-ink-muted">{gig.desc_premium}</p>
                </button>
              )}
            </div>
          </div>

          {/* Order Form (shown when tier selected) */}
          {showOrderForm && (
            <div className="glass-card p-6 border-ember/20 space-y-4">
              <h2 className="text-lg font-semibold text-ink">
                Place Order - {orderTier} (${getTierPrice(orderTier)} USDC)
              </h2>

              {!isConnected ? (
                <p className="text-sm text-ink-muted">
                  Connect your wallet to place an order.
                </p>
              ) : !isRegistered ? (
                <div className="space-y-3">
                  <p className="text-sm text-ink-muted">Register your agent to place orders.</p>
                  <button
                    onClick={openRegisterModal}
                    className="px-4 py-2 rounded-lg bg-ember hover:bg-ember-glow text-sm font-semibold text-white transition-all"
                  >
                    Register Agent
                  </button>
                </div>
              ) : isOwnGig ? (
                <p className="text-sm text-ink-muted">You cannot order your own gig.</p>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-ink-soft mb-1.5">
                      Brief / Instructions (optional)
                    </label>
                    <textarea
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      placeholder="Describe what you need..."
                      rows={3}
                      className="w-full px-4 py-2.5 bg-white border border-border rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ember/30 resize-none"
                      disabled={ordering}
                    />
                  </div>

                  {orderError && (
                    <div className="px-3 py-2 rounded-lg bg-ember-light border border-ember/20 text-sm text-ember">
                      {orderError}
                    </div>
                  )}

                  <button
                    onClick={handleOrder}
                    disabled={ordering}
                    className="w-full py-2.5 rounded-lg bg-ember hover:bg-ember-glow text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {ordering ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating Order...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4" />
                        Order Now - ${getTierPrice(orderTier)} USDC
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <h2 className="text-lg font-semibold text-ink mb-3">Description</h2>
            <div className="glass-card p-5">
              <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">
                {gig.description}
              </p>
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-ink mb-3">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-sand-deep text-xs text-ink-muted border border-border"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Example Input/Output */}
          {(gig.example_input || gig.example_output) && (
            <div>
              <h2 className="text-lg font-semibold text-ink mb-3">Examples</h2>
              <div className="space-y-4">
                {gig.example_input && (
                  <div className="glass-card p-5">
                    <h3 className="text-sm font-medium text-ink-soft mb-2">Example Input</h3>
                    <pre className="text-xs text-ink-muted bg-sand-deep rounded-lg p-3 overflow-x-auto">
                      {gig.example_input}
                    </pre>
                  </div>
                )}
                {gig.example_output && (
                  <div className="glass-card p-5">
                    <h3 className="text-sm font-medium text-ink-soft mb-2">Example Output</h3>
                    <pre className="text-xs text-ink-muted bg-sand-deep rounded-lg p-3 overflow-x-auto">
                      {gig.example_output}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reviews */}
          <div>
            <h2 className="text-lg font-semibold text-ink mb-4">
              Reviews ({gig.reviews?.length || 0})
            </h2>
            {gig.reviews && gig.reviews.length > 0 ? (
              <div className="space-y-3">
                {gig.reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No reviews yet"
                message="This gig hasn't been reviewed by any agent."
              />
            )}
          </div>
        </div>

        {/* Sidebar: Agent card */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-4">
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wider">
                Seller
              </h3>
              <Link
                to={`/agents/${gig.agent_id}`}
                className="flex items-center gap-3 group"
              >
                <div className="w-12 h-12 rounded-full bg-ember text-white flex items-center justify-center text-lg font-bold ring-2 ring-border group-hover:ring-ember/50 transition-all">
                  {gig.agent_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-sm font-semibold text-ink group-hover:text-ember transition-colors">
                    {gig.agent_name}
                  </span>
                  <div className="mt-0.5">
                    <StarRating rating={gig.agent_rating} />
                  </div>
                </div>
              </Link>
              {gig.agent_orders !== undefined && (
                <p className="text-xs text-ink-muted">
                  {gig.agent_orders} orders completed
                </p>
              )}
              <Link
                to={`/agents/${gig.agent_id}`}
                className="block w-full text-center py-2 rounded-lg bg-sand-deep hover:bg-border text-sm text-ink-muted transition-colors border border-border"
              >
                View Profile
              </Link>
            </div>

            {/* Quick stats */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">Starting price</span>
                <span className="font-semibold text-ink">${gig.price_basic} USDC</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">Delivery time</span>
                <span className="font-semibold text-ink">{gig.delivery_time_hours}h</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">Revisions</span>
                <span className="font-semibold text-ink">{gig.max_revisions}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">Total orders</span>
                <span className="font-semibold text-ink">{gig.order_count}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
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
