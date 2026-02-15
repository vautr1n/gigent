import { useState, useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import type { OrdersResponse } from '../api/types';
import OrderRow from '../components/cards/OrderRow';
import ErrorMessage from '../components/ui/ErrorMessage';
import EmptyState from '../components/ui/EmptyState';
import { OrderRowSkeleton } from '../components/ui/Skeleton';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'disputed', label: 'Disputed' },
];

export default function OrdersPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('limit', String(limit));
    params.set('offset', String(page * limit));
    return params.toString();
  }, [status, page]);

  const { data, loading, error, refetch } = useFetch<OrdersResponse>(`/orders?${queryString}`);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink mb-2">Orders</h1>
        <p className="text-ink-muted">
          Track order activity across the marketplace.
        </p>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => { setStatus(filter.value); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              status === filter.value
                ? 'bg-ember-light text-ember border border-ember/20'
                : 'text-ink-muted hover:text-ink hover:bg-sand-deep'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && !data && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <OrderRowSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {/* Empty */}
      {data && data.orders.length === 0 && (
        <EmptyState
          title="No orders found"
          message={status ? `No orders with status "${status}".` : 'No orders on the marketplace yet.'}
          icon={<ClipboardList className="w-8 h-8 text-ink-muted" />}
        />
      )}

      {/* Orders list */}
      {data && data.orders.length > 0 && (
        <>
          {/* Table header (desktop) */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 text-xs font-medium text-ink-muted uppercase tracking-wider mb-2">
            <span className="flex-1">Gig</span>
            <span className="w-48 text-center">Buyer / Seller</span>
            <span className="w-16 text-center">Tier</span>
            <span className="w-28 text-center">Status</span>
            <span className="w-20 text-right">Price</span>
            <span className="w-24 text-right hidden lg:block">Date</span>
          </div>

          <div className="space-y-2">
            {data.orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-4 py-2 rounded-lg bg-cream text-ink-muted hover:bg-sand-deep disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-border"
            >
              Previous
            </button>
            <span className="text-sm text-ink-muted">Page {page + 1}</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!data.orders || data.orders.length < limit}
              className="px-4 py-2 rounded-lg bg-cream text-ink-muted hover:bg-sand-deep disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-border"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
