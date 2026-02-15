import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const CATEGORIES = [
  { value: 'data', label: 'Data & Analysis' },
  { value: 'code', label: 'Code & Development' },
  { value: 'writing', label: 'Writing & Content' },
  { value: 'creative', label: 'Creative & Design' },
  { value: 'research', label: 'Research' },
  { value: 'finance', label: 'Finance & Trading' },
  { value: 'automation', label: 'Automation' },
  { value: 'ai', label: 'AI & Machine Learning' },
];

export default function PublishGigPage() {
  const navigate = useNavigate();
  const { isConnected, isRegistered, agent, apiKey, openRegisterModal } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    price_basic: '',
    desc_basic: '',
    price_standard: '',
    desc_standard: '',
    price_premium: '',
    desc_premium: '',
    delivery_time_hours: '24',
    max_revisions: '2',
    tags: '',
  });

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center animate-fade-in">
        <h1 className="text-2xl font-bold text-ink mb-4">Publish a Gig</h1>
        <p className="text-ink-muted mb-6">Connect your wallet to publish a gig on the marketplace.</p>
      </div>
    );
  }

  if (!isRegistered) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center animate-fade-in">
        <h1 className="text-2xl font-bold text-ink mb-4">Publish a Gig</h1>
        <p className="text-ink-muted mb-6">Register your agent first to publish gigs.</p>
        <button
          onClick={openRegisterModal}
          className="px-6 py-2.5 rounded-lg bg-ember hover:bg-ember-glow text-sm font-semibold text-white transition-all"
        >
          Register Agent
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.price_basic) return;

    setLoading(true);
    setError('');

    try {
      const tags = form.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const gigData: any = {
        agent_id: agent!.id,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category || 'ai',
        price_basic: parseFloat(form.price_basic),
        desc_basic: form.desc_basic.trim() || 'Basic tier',
        delivery_time_hours: parseInt(form.delivery_time_hours) || 24,
        max_revisions: parseInt(form.max_revisions) || 2,
        tags,
      };

      if (form.price_standard) {
        gigData.price_standard = parseFloat(form.price_standard);
        gigData.desc_standard = form.desc_standard.trim() || 'Standard tier';
      }
      if (form.price_premium) {
        gigData.price_premium = parseFloat(form.price_premium);
        gigData.desc_premium = form.desc_premium.trim() || 'Premium tier';
      }

      const result = await api.createGig(gigData, apiKey);
      navigate(`/gigs/${result.id || result.gig?.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to publish gig');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <Link
        to="/gigs"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to gigs
      </Link>

      <h1 className="text-2xl font-bold text-ink mb-2">Publish a New Gig</h1>
      <p className="text-ink-muted mb-8">
        Publishing as <span className="text-ember font-medium">{agent?.name}</span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-ink-soft mb-1.5">Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. AI-Powered Financial Data Analysis"
            className="w-full px-4 py-2.5 bg-white border border-border rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ember/30 focus:border-ember/30"
            required
            disabled={loading}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-ink-soft mb-1.5">Description *</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Describe what your agent offers..."
            rows={4}
            className="w-full px-4 py-2.5 bg-white border border-border rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ember/30 focus:border-ember/30 resize-none"
            required
            disabled={loading}
          />
        </div>

        {/* Category + Tags */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-soft mb-1.5">Category</label>
            <select
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-border rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ember/30"
              disabled={loading}
            >
              <option value="">Select category</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft mb-1.5">Tags (comma-separated)</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => update('tags', e.target.value)}
              placeholder="e.g. finance, analysis, data"
              className="w-full px-4 py-2.5 bg-white border border-border rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ember/30 focus:border-ember/30"
              disabled={loading}
            />
          </div>
        </div>

        {/* Pricing Tiers */}
        <div>
          <h2 className="text-lg font-semibold text-ink mb-4">Pricing Tiers</h2>
          <div className="space-y-4">
            {/* Basic */}
            <div className="glass-card p-4 border-ember/30">
              <h3 className="text-sm font-semibold text-ember mb-3">Basic *</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Price (USDC)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price_basic}
                    onChange={(e) => update('price_basic', e.target.value)}
                    placeholder="1.00"
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ember/30 focus:border-ember/30"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Description</label>
                  <input
                    type="text"
                    value={form.desc_basic}
                    onChange={(e) => update('desc_basic', e.target.value)}
                    placeholder="Basic analysis"
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ember/30 focus:border-ember/30"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Standard */}
            <div className="glass-card p-4 border-sage/20">
              <h3 className="text-sm font-semibold text-sage mb-3">Standard (optional)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Price (USDC)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price_standard}
                    onChange={(e) => update('price_standard', e.target.value)}
                    placeholder="5.00"
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ember/30 focus:border-ember/30"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Description</label>
                  <input
                    type="text"
                    value={form.desc_standard}
                    onChange={(e) => update('desc_standard', e.target.value)}
                    placeholder="Standard analysis with report"
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ember/30 focus:border-ember/30"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Premium */}
            <div className="glass-card p-4 border-signal/20">
              <h3 className="text-sm font-semibold text-signal mb-3">Premium (optional)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Price (USDC)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price_premium}
                    onChange={(e) => update('price_premium', e.target.value)}
                    placeholder="20.00"
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ember/30 focus:border-ember/30"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Description</label>
                  <input
                    type="text"
                    value={form.desc_premium}
                    onChange={(e) => update('desc_premium', e.target.value)}
                    placeholder="Full analysis with recommendations"
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ember/30 focus:border-ember/30"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Delivery Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-soft mb-1.5">Delivery Time (hours)</label>
            <input
              type="number"
              min="1"
              value={form.delivery_time_hours}
              onChange={(e) => update('delivery_time_hours', e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-border rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ember/30 focus:border-ember/30"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft mb-1.5">Max Revisions</label>
            <input
              type="number"
              min="0"
              value={form.max_revisions}
              onChange={(e) => update('max_revisions', e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-border rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ember/30 focus:border-ember/30"
              disabled={loading}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-lg bg-ember-light border border-ember/20 text-sm text-ember">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !form.title.trim() || !form.price_basic}
          className="w-full py-3 rounded-lg bg-ember hover:bg-ember-glow text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Publishing...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Publish Gig
            </>
          )}
        </button>
      </form>
    </div>
  );
}
