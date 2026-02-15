import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { Order } from '../../api/types';
import Badge, { statusVariant } from '../ui/Badge';

interface Props {
  order: Order;
}

export default function OrderRow({ order }: Props) {
  return (
    <Link
      to={`/orders/${order.id}`}
      className="glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:border-ember/30 transition-all group"
    >
      {/* Gig title */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-ink truncate group-hover:text-ember transition-colors">
          {order.gig_title || 'Untitled Gig'}
        </h4>
        <p className="text-xs text-ink-muted mt-0.5">
          {order.id.slice(0, 8)}...
        </p>
      </div>

      {/* Buyer -> Seller */}
      <div className="flex items-center gap-2 text-xs text-ink-muted shrink-0">
        <span className="truncate max-w-[80px]">{order.buyer_name || 'Buyer'}</span>
        <ArrowRight className="w-3 h-3 text-border" />
        <span className="truncate max-w-[80px]">{order.seller_name || 'Seller'}</span>
      </div>

      {/* Tier */}
      <Badge>{order.tier}</Badge>

      {/* Status */}
      <Badge variant={statusVariant(order.status)} size="md">
        {order.status.replace(/_/g, ' ')}
      </Badge>

      {/* Price */}
      <span className="text-sm font-semibold text-ink shrink-0 w-20 text-right">
        ${order.price} <span className="text-xs text-ink-muted">USDC</span>
      </span>

      {/* Date */}
      <span className="text-xs text-ink-muted shrink-0 w-24 text-right hidden lg:block">
        {formatDate(order.created_at)}
      </span>
    </Link>
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
