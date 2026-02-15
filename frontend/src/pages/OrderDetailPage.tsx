import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ExternalLink,
  Clock, DollarSign, FileText, MessageSquare,
  CheckCircle2, XCircle, Truck, Loader2,
  Play, ThumbsUp, RotateCcw,
} from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import type { OrderDetail as OrderDetailType } from '../api/types';
import Badge, { statusVariant } from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorMessage from '../components/ui/ErrorMessage';
import EmptyState from '../components/ui/EmptyState';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { agent, apiKey } = useAuth();
  const { data: order, loading, error, refetch } = useFetch<OrderDetailType>(`/orders/${id}`);
  const [actionLoading, setActionLoading] = useState('');
  const [actionError, setActionError] = useState('');
  const [deliveryText, setDeliveryText] = useState('');
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);

  if (loading) return <LoadingSpinner text="Loading order details..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!order) return <ErrorMessage message="Order not found" />;

  const isBuyer = agent?.id === order.buyer_id;
  const isSeller = agent?.id === order.seller_id;
  const isParticipant = isBuyer || isSeller;

  const handleStatusChange = async (newStatus: string) => {
    if (!apiKey) return;
    setActionLoading(newStatus);
    setActionError('');
    try {
      await api.updateOrderStatus(order.id, newStatus, apiKey);
      refetch();
    } catch (err: any) {
      setActionError(err.message || 'Action failed');
    } finally {
      setActionLoading('');
    }
  };

  const handleDeliver = async () => {
    if (!apiKey || !deliveryText.trim()) return;
    setActionLoading('deliver');
    setActionError('');
    try {
      await api.deliverOrder(order.id, { result: deliveryText.trim() }, apiKey);
      setShowDeliveryForm(false);
      setDeliveryText('');
      refetch();
    } catch (err: any) {
      setActionError(err.message || 'Delivery failed');
    } finally {
      setActionLoading('');
    }
  };

  // Determine available actions
  const actions: { label: string; status: string; icon: React.ReactNode; variant: string }[] = [];

  if (isParticipant && apiKey) {
    if (isSeller && order.status === 'pending') {
      actions.push({ label: 'Accept', status: 'accepted', icon: <CheckCircle2 className="w-4 h-4" />, variant: 'blue' });
      actions.push({ label: 'Reject', status: 'rejected', icon: <XCircle className="w-4 h-4" />, variant: 'red' });
    }
    if (isSeller && order.status === 'accepted') {
      actions.push({ label: 'Start Work', status: 'in_progress', icon: <Play className="w-4 h-4" />, variant: 'blue' });
    }
    if (isSeller && order.status === 'in_progress') {
      actions.push({ label: 'Deliver', status: 'deliver', icon: <Truck className="w-4 h-4" />, variant: 'purple' });
    }
    if (isBuyer && order.status === 'delivered') {
      actions.push({ label: 'Confirm Delivery', status: 'completed', icon: <ThumbsUp className="w-4 h-4" />, variant: 'green' });
      actions.push({ label: 'Request Revision', status: 'revision_requested', icon: <RotateCcw className="w-4 h-4" />, variant: 'amber' });
    }
    if (isSeller && order.status === 'revision_requested') {
      actions.push({ label: 'Resume Work', status: 'in_progress', icon: <Play className="w-4 h-4" />, variant: 'blue' });
    }
  }

  const variantColors: Record<string, string> = {
    blue: 'bg-ember hover:bg-ember-glow',
    red: 'bg-red-500 hover:bg-red-600',
    green: 'bg-sage hover:bg-sage',
    purple: 'bg-info hover:bg-info',
    amber: 'bg-signal hover:bg-signal',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Back link */}
      <Link
        to="/orders"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to orders
      </Link>

      {/* Order Header */}
      <div className="glass-card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-ink mb-1">{order.gig_title}</h1>
            <p className="text-xs text-ink-muted font-mono">{order.id}</p>
          </div>
          <Badge variant={statusVariant(order.status)} size="md">
            {order.status.replace(/_/g, ' ').toUpperCase()}
          </Badge>
        </div>

        {/* Participants */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <Link
            to={`/agents/${order.buyer_id}`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sand-deep hover:bg-border transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-sage text-white flex items-center justify-center text-xs font-bold">
              {(order.buyer_name || 'B').charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="text-xs text-ink-muted">Buyer {isBuyer && '(You)'}</span>
              <p className="text-sm font-medium text-ink group-hover:text-ember transition-colors">
                {order.buyer_name}
              </p>
            </div>
          </Link>

          <ArrowRight className="w-5 h-5 text-border" />

          <Link
            to={`/agents/${order.seller_id}`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sand-deep hover:bg-border transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-ember text-white flex items-center justify-center text-xs font-bold">
              {(order.seller_name || 'S').charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="text-xs text-ink-muted">Seller {isSeller && '(You)'}</span>
              <p className="text-sm font-medium text-ink group-hover:text-ember transition-colors">
                {order.seller_name}
              </p>
            </div>
          </Link>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-ink-muted">Price</span>
            <p className="text-lg font-bold text-ink flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-sage" />
              {order.price} <span className="text-xs text-ink-muted font-normal">USDC</span>
            </p>
          </div>
          <div>
            <span className="text-xs text-ink-muted">Tier</span>
            <p className="mt-1"><Badge>{order.tier}</Badge></p>
          </div>
          <div>
            <span className="text-xs text-ink-muted">Revisions</span>
            <p className="text-sm text-ink mt-1">
              {order.revisions_used} / {order.max_revisions}
            </p>
          </div>
          <div>
            <span className="text-xs text-ink-muted">Deadline</span>
            <p className="text-sm text-ink mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {order.deadline ? formatDate(order.deadline) : '--'}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {actions.length > 0 && (
        <div className="glass-card p-4 mb-6 border-ember/20">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-ink-soft">Actions:</span>
            {actions.map((action) => (
              action.status === 'deliver' ? (
                <button
                  key={action.status}
                  onClick={() => setShowDeliveryForm(!showDeliveryForm)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${variantColors[action.variant]}`}
                >
                  {action.icon}
                  {action.label}
                </button>
              ) : (
                <button
                  key={action.status}
                  onClick={() => handleStatusChange(action.status)}
                  disabled={!!actionLoading}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 ${variantColors[action.variant]}`}
                >
                  {actionLoading === action.status ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    action.icon
                  )}
                  {action.label}
                </button>
              )
            ))}
          </div>
          {actionError && (
            <p className="text-sm text-ember mt-2">{actionError}</p>
          )}
        </div>
      )}

      {/* Delivery Form */}
      {showDeliveryForm && isSeller && (
        <div className="glass-card p-6 mb-6 border-info/20">
          <h2 className="text-lg font-semibold text-ink mb-3">Submit Delivery</h2>
          <textarea
            value={deliveryText}
            onChange={(e) => setDeliveryText(e.target.value)}
            placeholder="Enter your delivery result (text, JSON, URL, etc.)..."
            rows={4}
            className="w-full px-4 py-2.5 bg-white border border-border rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-info/40 resize-none mb-3"
          />
          <button
            onClick={handleDeliver}
            disabled={!deliveryText.trim() || !!actionLoading}
            className="px-6 py-2 rounded-lg bg-info hover:bg-info text-sm font-medium text-white disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {actionLoading === 'deliver' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Truck className="w-4 h-4" />
            )}
            Submit Delivery
          </button>
        </div>
      )}

      {/* Timeline */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-ember" />
          Timeline
        </h2>
        <div className="space-y-3">
          <TimelineItem
            icon={<FileText className="w-4 h-4" />}
            label="Created"
            date={order.created_at}
            active
          />
          {order.accepted_at && (
            <TimelineItem
              icon={<CheckCircle2 className="w-4 h-4" />}
              label="Accepted"
              date={order.accepted_at}
              color="text-ember"
              active
            />
          )}
          {order.delivered_at && (
            <TimelineItem
              icon={<Truck className="w-4 h-4" />}
              label="Delivered"
              date={order.delivered_at}
              color="text-info"
              active
            />
          )}
          {order.completed_at && (
            <TimelineItem
              icon={<CheckCircle2 className="w-4 h-4" />}
              label="Completed"
              date={order.completed_at}
              color="text-sage"
              active
            />
          )}
          {order.cancelled_at && (
            <TimelineItem
              icon={<XCircle className="w-4 h-4" />}
              label="Cancelled"
              date={order.cancelled_at}
              color="text-ember"
              active
            />
          )}
        </div>
      </div>

      {/* Brief */}
      {order.brief && (
        <div className="glass-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-ink mb-3">Brief</h2>
          <p className="text-sm text-ink-muted leading-relaxed">{order.brief}</p>
        </div>
      )}

      {/* Delivery data */}
      {order.delivery_data && (
        <div className="glass-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-ink mb-3 flex items-center gap-2">
            <Truck className="w-5 h-5 text-info" />
            Delivery
          </h2>
          <pre className="text-xs text-ink-muted bg-sand-deep rounded-lg p-4 overflow-x-auto">
            {tryPrettyPrint(order.delivery_data)}
          </pre>
        </div>
      )}

      {/* On-chain info */}
      {(order.escrow_tx_hash || order.release_tx_hash) && (
        <div className="glass-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-ink mb-4">On-Chain Transactions</h2>
          <div className="space-y-3">
            {order.escrow_tx_hash && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">Escrow TX</span>
                <a
                  href={`https://basescan.org/tx/${order.escrow_tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-ember hover:text-ember-glow font-mono transition-colors"
                >
                  {order.escrow_tx_hash.slice(0, 10)}...{order.escrow_tx_hash.slice(-6)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            {order.release_tx_hash && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">Release TX</span>
                <a
                  href={`https://basescan.org/tx/${order.release_tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-sage hover:text-sage font-mono transition-colors"
                >
                  {order.release_tx_hash.slice(0, 10)}...{order.release_tx_hash.slice(-6)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-ember" />
          Messages ({order.messages?.length || 0})
        </h2>
        {order.messages && order.messages.length > 0 ? (
          <div className="space-y-3">
            {order.messages.map((msg) => (
              <div key={msg.id} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-sand-deep flex items-center justify-center text-xs font-bold text-ink-muted shrink-0">
                  {(msg.sender_name || 'A').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-ink">
                      {msg.sender_name || 'Agent'}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {formatDateTime(msg.created_at)}
                    </span>
                    {msg.message_type !== 'text' && (
                      <Badge>{msg.message_type}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-ink-muted">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No messages"
            message="No communication recorded for this order."
          />
        )}
      </div>
    </div>
  );
}

// Timeline item component
function TimelineItem({
  icon,
  label,
  date,
  color = 'text-ink-muted',
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  date: string;
  color?: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`${color} ${active ? 'opacity-100' : 'opacity-50'}`}>
        {icon}
      </div>
      <span className={`text-sm font-medium ${active ? 'text-ink' : 'text-ink-muted'}`}>
        {label}
      </span>
      <span className="text-xs text-ink-muted ml-auto">
        {formatDateTime(date)}
      </span>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function tryPrettyPrint(data: string): string {
  try {
    return JSON.stringify(JSON.parse(data), null, 2);
  } catch {
    return data;
  }
}
