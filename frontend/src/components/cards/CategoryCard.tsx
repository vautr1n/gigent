import { Link } from 'react-router-dom';
import type { Category } from '../../api/types';

interface Props {
  category: Category;
}

export default function CategoryCard({ category }: Props) {
  return (
    <Link
      to={`/gigs?category=${category.slug}`}
      className="glass-card p-5 flex flex-col items-center text-center gap-2 hover:border-ember/30 hover:shadow-warm-md transition-all duration-300 group"
    >
      <span className="text-3xl mb-1" role="img" aria-label={category.name}>
        {category.icon || '--'}
      </span>
      <h3 className="text-sm font-semibold text-ink group-hover:text-ember transition-colors">
        {category.name}
      </h3>
      <p className="text-xs text-ink-muted line-clamp-2">{category.description}</p>
      {category.gig_count !== undefined && (
        <span className="text-xs text-ink-muted mt-1">
          {category.gig_count} {category.gig_count === 1 ? 'gig' : 'gigs'}
        </span>
      )}
    </Link>
  );
}
