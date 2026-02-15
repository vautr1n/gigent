const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const res = await fetch(url, options);

  if (!res.ok) {
    let message = `API error: ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(message, res.status);
  }

  return res.json();
}

function authHeaders(apiKey?: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;
  return headers;
}

// Convenience functions for specific endpoints
export const api = {
  // Health
  health: () => apiFetch<import('./types').HealthResponse>('/health'),

  // Marketplace
  featured: () => apiFetch<import('./types').FeaturedData>('/marketplace/featured'),
  stats: () => apiFetch<import('./types').MarketplaceStats>('/marketplace/stats'),
  search: (q: string) => apiFetch<import('./types').SearchResults>(`/marketplace/search?q=${encodeURIComponent(q)}`),

  // Categories
  categories: () => apiFetch<import('./types').CategoriesResponse>('/categories'),

  // Gigs
  gigs: (params?: string) => apiFetch<import('./types').GigsResponse>(`/gigs${params ? `?${params}` : ''}`),
  gig: (id: string) => apiFetch<import('./types').GigDetail>(`/gigs/${id}`),

  // Agents
  agents: (params?: string) => apiFetch<import('./types').AgentsResponse>(`/agents${params ? `?${params}` : ''}`),
  agent: (id: string) => apiFetch<import('./types').AgentDetail>(`/agents/${id}`),

  // Orders
  orders: (params?: string) => apiFetch<import('./types').OrdersResponse>(`/orders${params ? `?${params}` : ''}`),
  order: (id: string) => apiFetch<import('./types').OrderDetail>(`/orders/${id}`),

  // Reviews
  reviews: () => apiFetch<import('./types').Review[]>('/reviews'),

  // ─── Write operations ───

  createOrder: (data: { gig_id: string; tier: string; brief?: string; buyer_id?: string }, apiKey?: string | null) =>
    apiFetch<any>('/orders', {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify(data),
    }),

  updateOrderStatus: (orderId: string, status: string, apiKey?: string | null) =>
    apiFetch<any>(`/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ status }),
    }),

  deliverOrder: (orderId: string, data: { result: string; delivery_hash?: string }, apiKey?: string | null) =>
    apiFetch<any>(`/orders/${orderId}/deliver`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify(data),
    }),

  createGig: (data: any, apiKey?: string | null) =>
    apiFetch<any>('/gigs', {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify(data),
    }),

  leaveReview: (data: { order_id: string; rating: number; comment?: string }, apiKey?: string | null) =>
    apiFetch<any>('/reviews', {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify(data),
    }),
};
