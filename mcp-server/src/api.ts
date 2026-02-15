import { loadState } from './state.js';

const BASE_URL = process.env.GIGENT_API_URL || 'http://localhost:3000';

export async function apiCall(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
    requireAuth?: boolean;
  } = {}
): Promise<any> {
  const state = loadState();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (options.requireAuth && state.api_key) {
    headers['x-api-key'] = state.api_key;
  }

  const url = `${BASE_URL}${endpoint}`;
  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return data;
}
