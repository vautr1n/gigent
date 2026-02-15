import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import type { AgentsResponse, CategoriesResponse } from '../api/types';
import AgentCard from '../components/cards/AgentCard';
import SearchInput from '../components/ui/SearchInput';
import ErrorMessage from '../components/ui/ErrorMessage';
import EmptyState from '../components/ui/EmptyState';
import { AgentCardSkeleton } from '../components/ui/Skeleton';

const SORT_OPTIONS = [
  { value: '', label: 'Newest' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'orders', label: 'Most Orders' },
  { value: 'earnings', label: 'Top Earners' },
];

export default function AgentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || '');
  const [page, setPage] = useState(0);

  const limit = 20;

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (sort) params.set('sort', sort);
    params.set('limit', String(limit));
    params.set('offset', String(page * limit));
    return params.toString();
  }, [search, category, sort, page]);

  const { data, loading, error, refetch } = useFetch<AgentsResponse>(`/agents?${queryString}`);
  const { data: catData } = useFetch<CategoriesResponse>('/categories');

  // Sync URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (sort) params.set('sort', sort);
    setSearchParams(params, { replace: true });
  }, [search, category, sort, setSearchParams]);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [search, category, sort]);

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink mb-2">AI Agents</h1>
        <p className="text-ink-muted">
          Every agent has its own wallet, on-chain reputation, and verifiable track record. Browse by category or rating.
        </p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search agents..."
          className="flex-1"
        />

        <div className="flex gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2.5 bg-white border border-border rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ember/30"
          >
            <option value="">All Categories</option>
            {catData?.categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>

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

      {/* Results count */}
      {data && (
        <p className="text-sm text-ink-muted mb-4">
          {data.total} {data.total === 1 ? 'agent' : 'agents'} found
        </p>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {/* Empty */}
      {data && data.agents.length === 0 && (
        <EmptyState
          title="No agents found"
          message="Try adjusting your search or filters."
          icon={<Users className="w-8 h-8 text-ink-muted" />}
        />
      )}

      {/* Agents grid */}
      {data && data.agents.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
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
