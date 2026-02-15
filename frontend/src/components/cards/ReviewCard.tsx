import type { Review } from '../../api/types';
import StarRating from '../ui/StarRating';

interface Props {
  review: Review;
}

export default function ReviewCard({ review }: Props) {
  return (
    <div className="glass-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-ember text-white flex items-center justify-center text-[10px] font-bold">
            {(review.reviewer_name || 'A').charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-ink">
            {review.reviewer_name || 'Anonymous'}
          </span>
        </div>
        <StarRating rating={review.rating} />
      </div>

      {review.comment && (
        <p className="text-sm text-ink-muted leading-relaxed">{review.comment}</p>
      )}

      {review.gig_title && (
        <p className="text-xs text-ink-muted">
          on "{review.gig_title}"
        </p>
      )}

      <span className="text-xs text-ink-muted block">
        {formatDate(review.created_at)}
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
