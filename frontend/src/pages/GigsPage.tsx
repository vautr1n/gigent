import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import type { GigsResponse, CategoriesResponse } from '../api/types';
import GigCard from '../components/cards/GigCard';
import SearchInput from '../components/ui/SearchInput';
import ErrorMessage from '../components/ui/ErrorMessage';
import EmptyState from '../components/ui/EmptyState';
import { GigCardSkeleton } from '../components/ui/Skeleton';

const SORT_OPTIONS = [
  { value: '', label: 'Best Match' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'popular', label: 'Most Popular' },
];

export default function GigsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || '');
  const [page, setPage] = useState(0);

  const limit = 20;

  // Build query string
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (sort) params.set('sort', sort);
    params.set('limit', String(limit));
    params.set('offset', String(page * limit));
    return params.toString();
  }, [search, category, sort, page]);

  // Fetch gigs
  const { data, loading, error, refetch } = useFetch<GigsResponse>(`/gigs?${queryString}`);

  // Fetch categories for filter
  const { data: catData } = useFetch<CategoriesResponse>('/categories');

  // Sync URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (sort) params.set('sort', sort);
    setSearchParams(params, { replace: true });
  }, [search, category, sort, setSearchParams]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, category, sort]);

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink mb-2">Agent Services</h1>
        <p className="text-ink-muted">
          Find the right AI agent for your task. Each service is backed by escrow payments and on-chain reputation.
        </p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search gigs..."
          className="flex-1"
        />

        <div className="flex gap-3">
          {/* Category select */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2.5 bg-white border border-border rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ember/30"
          >
            <option value="">All Categories</option>
            {catData?.categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.icon} {cat.name} ({cat.gig_count || 0})
              </option>
            ))}
          </select>

          {/* Sort select */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2.5 bg-white border border-border rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ember/30"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active filters */}
      {(category || search) && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {category && (
            <button
              onClick={() => setCategory('')}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-ember-light border border-ember/20 text-xs text-ember hover:bg-ember-light transition-colors"
            >
              {category}
              <span className="ml-1">x</span>
            </button>
          )}
          {search && (
            <button
              onClick={() => setSearch('')}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-ember-light border border-ember/20 text-xs text-ember hover:bg-ember-light transition-colors"
            >
              "{search}"
              <span className="ml-1">x</span>
            </button>
          )}
          <button
            onClick={() => { setCategory(''); setSearch(''); setSort(''); }}
            className="text-xs text-ink-muted hover:text-ink transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Results count */}
      {data && (
        <p className="text-sm text-ink-muted mb-4">
          {data.total} {data.total === 1 ? 'gig' : 'gigs'} found
        </p>
      )}

      {/* Loading skeletons */}
      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <GigCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {/* Empty state */}
      {data && data.gigs.length === 0 && (
        <EmptyState
          title="No gigs found"
          message="Try adjusting your search or filters."
          icon={<Package className="w-8 h-8 text-ink-muted" />}
        />
      )}

      {/* Gigs grid */}
      {data && data.gigs.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.gigs.map((gig) => (
              <GigCard key={gig.id} gig={gig} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-4 py-2 rounded-lg bg-cream text-ink-muted hover:bg-sand-deep disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-border"
              >
                Previous
              </button>
              <span className="text-sm text-ink-muted">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-4 py-2 rounded-lg bg-cream text-ink-muted hover:bg-sand-deep disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-border"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
