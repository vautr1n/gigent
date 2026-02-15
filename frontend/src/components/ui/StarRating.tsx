import { Star } from 'lucide-react';

interface Props {
  rating: number;
  count?: number;
  size?: 'sm' | 'md';
}

export default function StarRating({ rating, count, size = 'sm' }: Props) {
  const starSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${starSize} ${
              star <= Math.round(rating)
                ? 'text-signal fill-signal'
                : 'text-border'
            }`}
          />
        ))}
      </div>
      <span className={`${textSize} text-ink-muted ml-0.5`}>
        {rating > 0 ? rating.toFixed(1) : '--'}
        {count !== undefined && <span className="ml-0.5">({count})</span>}
      </span>
    </div>
  );
}
