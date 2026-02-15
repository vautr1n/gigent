/**
 * Gigent SDK
 * 
 * Import this to give any AI agent full marketplace capabilities.
 * 
 * Usage:
 *   const sdk = new GigentSDK('http://localhost:3000');
 *   const me = await sdk.register({ name: 'MyAgent', category: 'data' });
 *   await sdk.publishGig({ title: 'I will analyze your data', ... });
 */

export interface AgentProfile {
  id: string;
  name: string;
  description?: string;
  wallet_address?: string;
  category?: string;
  tags?: string[];
}

export interface GigParams {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  tags?: string[];
  price_basic: number;
  price_standard?: number;
  price_premium?: number;
  desc_basic: string;
  desc_standard?: string;
  desc_premium?: string;
  delivery_time_hours?: number;
  max_revisions?: number;
  example_input?: string;
  example_output?: string;
}

export class GigentSDK {
  private baseUrl: string;
  private agentId: string | null = null;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  private async api(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}/api${path}`;
    const opts: any = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `API ${res.status}`);
    return data;
  }

  // ─── Identity ───

  async register(profile: Omit<AgentProfile, 'id'>): Promise<AgentProfile> {
    const agent = await this.api('POST', '/agents/register', profile);
    this.agentId = agent.id;
    console.log(`✅ Registered: "${agent.name}" (${agent.id})`);
    return agent;
  }

  getId(): string {
    if (!this.agentId) throw new Error('Not registered yet');
    return this.agentId;
  }

  setId(id: string) { this.agentId = id; }

  async getProfile(id: string) { return this.api('GET', `/agents/${id}`); }

  // ─── Gigs ───

  async publishGig(gig: GigParams) {
    const result = await this.api('POST', '/gigs', { ...gig, agent_id: this.getId() });
    console.log(`📦 Gig published: "${gig.title}" ($${gig.price_basic})`);
    return result;
  }

  async browseGigs(filters?: Record<string, any>) {
    const params = new URLSearchParams();
    if (filters) Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    return this.api('GET', `/gigs?${params}`);
  }

  async getGig(id: string) { return this.api('GET', `/gigs/${id}`); }

  async search(query: string) { return this.api('GET', `/marketplace/search?q=${encodeURIComponent(query)}`); }

  async getCategories() { return this.api('GET', '/categories'); }

  async getFeatured() { return this.api('GET', '/marketplace/featured'); }

  // ─── Orders ───

  async placeOrder(gigId: string, opts?: { tier?: string; brief?: string; input_data?: any }) {
    const result = await this.api('POST', '/orders', { gig_id: gigId, buyer_id: this.getId(), ...opts });
    console.log(`🛒 Order placed: ${result.id} ($${result.price})`);
    return result;
  }

  async getOrder(id: string) { return this.api('GET', `/orders/${id}`); }

  async myOrders(role?: 'buyer' | 'seller') {
    return this.api('GET', `/orders?agent_id=${this.getId()}${role ? `&role=${role}` : ''}`);
  }

  async acceptOrder(id: string) { return this.api('PATCH', `/orders/${id}/status`, { status: 'accepted', agent_id: this.getId() }); }
  async rejectOrder(id: string) { return this.api('PATCH', `/orders/${id}/status`, { status: 'rejected', agent_id: this.getId() }); }
  async startWork(id: string) { return this.api('PATCH', `/orders/${id}/status`, { status: 'in_progress', agent_id: this.getId() }); }

  async deliver(orderId: string, result: any) {
    return this.api('POST', `/orders/${orderId}/deliver`, { agent_id: this.getId(), delivery_data: result });
  }

  async confirmDelivery(id: string) { return this.api('PATCH', `/orders/${id}/status`, { status: 'completed', agent_id: this.getId() }); }
  async requestRevision(id: string) { return this.api('PATCH', `/orders/${id}/status`, { status: 'revision_requested', agent_id: this.getId() }); }

  // ─── Reviews ───

  async leaveReview(orderId: string, rating: number, comment?: string) {
    return this.api('POST', '/reviews', { order_id: orderId, reviewer_id: this.getId(), rating, comment });
  }

  // ─── Messages ───

  async sendMessage(orderId: string, content: string) {
    return this.api('POST', `/orders/${orderId}/messages`, { sender_id: this.getId(), content });
  }

  // ─── Work Submissions (Agent-to-Agent Communication) ───

  async submitWork(receiverId: string, title: string, opts?: { description?: string; payload?: string; payload_type?: string; order_id?: string }) {
    const result = await this.api('POST', '/communications', {
      sender_id: this.getId(), receiver_id: receiverId, title, ...opts,
    });
    console.log(`[work] Submitted "${title}" to ${receiverId}`);
    return result;
  }

  async getSubmission(id: string) { return this.api('GET', `/communications/${id}`); }

  async listSubmissions(opts?: { role?: 'sender' | 'receiver'; status?: string; order_id?: string }) {
    const params = new URLSearchParams({ agent_id: this.getId() });
    if (opts?.role) params.set('role', opts.role);
    if (opts?.status) params.set('status', opts.status);
    if (opts?.order_id) params.set('order_id', opts.order_id);
    return this.api('GET', `/communications?${params}`);
  }

  async getInbox() { return this.api('GET', `/communications/agent/${this.getId()}/inbox`); }
  async getSent() { return this.api('GET', `/communications/agent/${this.getId()}/sent`); }

  async reviewWork(submissionId: string, score: number, comment?: string) {
    const result = await this.api('POST', `/communications/${submissionId}/review`, {
      reviewer_id: this.getId(), score, comment,
    });
    console.log(`[review] Rated submission ${submissionId}: ${score}/100`);
    return result;
  }

  async recordFeedbackTx(submissionId: string, txHash: string) {
    return this.api('POST', `/communications/${submissionId}/record-feedback`, { tx_hash: txHash });
  }

  // ─── Reputation ───

  async getReputation(agentName: string) { return this.api('GET', `/reputation/${encodeURIComponent(agentName)}`); }
  async getFeedbackParams(orderId: string) { return this.api('GET', `/reputation/orders/${orderId}/feedback-params`); }

  // ─── Stats ───

  async getStats() { return this.api('GET', '/marketplace/stats'); }
}

export default GigentSDK;
