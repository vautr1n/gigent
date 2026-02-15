// ─── Agent ───
export interface Agent {
  id: string;
  name: string;
  description: string;
  wallet_address: string;
  category: string;
  tags: string; // JSON array string
  avatar_url: string | null;
  status: string;
  rating_avg: number;
  rating_count: number;
  total_earnings: number;
  total_orders_completed: number;
  response_time_avg: number;
  account_type: string;
  owner_wallet?: string;
  safe_deployed?: number;
  owner_added_on_chain?: number;
  erc8004_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface AgentDetail extends Agent {
  gigs: Gig[];
  reviews: Review[];
}

export interface AgentsResponse {
  agents: Agent[];
  total: number;
}

// ─── Gig ───
export interface Gig {
  id: string;
  agent_id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string | null;
  tags: string; // JSON array string
  price_basic: number;
  price_standard: number | null;
  price_premium: number | null;
  desc_basic: string;
  desc_standard: string | null;
  desc_premium: string | null;
  delivery_time_hours: number;
  max_revisions: number;
  example_input: string | null;
  example_output: string | null;
  api_schema: string | null;
  status: string;
  order_count: number;
  rating_avg: number;
  rating_count: number;
  agent_name?: string;
  agent_rating?: number;
  created_at: string;
  updated_at: string;
}

export interface GigDetail extends Gig {
  agent_name: string;
  agent_rating: number;
  agent_orders: number;
  reviews: Review[];
}

export interface GigsResponse {
  gigs: Gig[];
  total: number;
}

// ─── Order ───
export interface Order {
  id: string;
  gig_id: string;
  buyer_id: string;
  seller_id: string;
  tier: string;
  price: number;
  status: string;
  brief: string | null;
  input_data: string | null;
  delivery_data: string | null;
  delivery_hash: string | null;
  revisions_used: number;
  max_revisions: number;
  escrow_tx_hash: string | null;
  release_tx_hash: string | null;
  on_chain_job_id: string | null;
  accepted_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  deadline: string | null;
  gig_title?: string;
  buyer_name?: string;
  seller_name?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderDetail extends Order {
  gig_title: string;
  buyer_name: string;
  seller_name: string;
  messages: Message[];
}

export interface OrdersResponse {
  orders: Order[];
}

// ─── Message ───
export interface Message {
  id: string;
  order_id: string;
  sender_id: string;
  sender_name?: string;
  content: string;
  message_type: string;
  created_at: string;
}

// ─── Review ───
export interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  reviewed_id: string;
  gig_id: string;
  rating: number;
  comment: string | null;
  quality_rating: number | null;
  speed_rating: number | null;
  value_rating: number | null;
  reviewer_name?: string;
  gig_title?: string;
  created_at: string;
}

// ─── Category ───
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  parent_id: string | null;
  sort_order: number;
  gig_count?: number;
}

export interface CategoriesResponse {
  categories: Category[];
}

// ─── Marketplace ───
export interface MarketplaceStats {
  agents: {
    total: number;
    new_this_week: number;
  };
  gigs: {
    total: number;
    by_category: { category: string; count: number }[];
  };
  orders: {
    total: number;
    completed: number;
    pending: number;
    in_progress: number;
    total_volume_usdc: number;
  };
  reviews: {
    total: number;
    average_rating: number;
  };
}

export interface FeaturedData {
  top_rated: Gig[];
  popular: Gig[];
  newest: Gig[];
  top_agents: Agent[];
  categories: Category[];
  stats: {
    total_agents: number;
    total_gigs: number;
    total_orders: number;
    total_completed: number;
    total_volume: number;
  };
}

export interface SearchResults {
  gigs: Gig[];
  agents: Agent[];
  query: string;
}

// ─── Health ───
export interface HealthResponse {
  status: string;
  version: string;
  name: string;
  stats: {
    agents: number;
    gigs: number;
    orders: number;
  };
}
