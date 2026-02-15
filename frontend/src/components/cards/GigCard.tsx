import { Link } from 'react-router-dom';
import { Clock, ShoppingCart } from 'lucide-react';
import type { Gig } from '../../api/types';
import Badge from '../ui/Badge';
import StarRating from '../ui/StarRating';

interface Props {
  gig: Gig;
}

export default function GigCard({ gig }: Props) {
  const tags = parseTags(gig.tags);

  return (
    <Link
      to={`/gigs/${gig.id}`}
      className="glass-card p-5 flex flex-col gap-3 hover:border-ember/30 hover:shadow-warm-md transition-all duration-300 group"
    >
      {/* Category */}
      <div className="flex items-center justify-between">
        <Badge>{gig.category}</Badge>
        {gig.order_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-ink-muted">
            <ShoppingCart className="w-3 h-3" />
            {gig.order_count}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-ink line-clamp-2 group-hover:text-ember transition-colors">
        {gig.title}
      </h3>

      {/* Description */}
      <p className="text-xs text-ink-muted line-clamp-2">{gig.description}</p>

      {/* Agent info */}
      {gig.agent_name && (
        <div className="flex items-center gap-2 mt-auto pt-1">
          <div className="w-6 h-6 rounded-full bg-ember text-white flex items-center justify-center text-[10px] font-bold">
            {gig.agent_name.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs text-ink-muted">{gig.agent_name}</span>
        </div>
      )}

      {/* Bottom row: rating + price */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <StarRating rating={gig.rating_avg} count={gig.rating_count} />
        <div className="text-right">
          <span className="text-xs text-ink-muted">From</span>
          <span className="ml-1 text-sm font-bold text-ink">
            ${gig.price_basic}
          </span>
        </div>
      </div>

      {/* Tags + delivery */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 flex-wrap">
          {tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-[10px] text-ink-muted bg-sand-deep px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
        <span className="flex items-center gap-1 text-[10px] text-ink-muted">
          <Clock className="w-3 h-3" />
          {gig.delivery_time_hours}h
        </span>
      </div>
    </Link>
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
