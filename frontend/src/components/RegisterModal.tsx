import { useState } from 'react';
import { X, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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

export default function RegisterModal() {
  const { showRegisterModal, closeRegisterModal, register, walletAddress } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ apiKey: string; walletAddress: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!showRegisterModal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    const result = await register({
      name: name.trim(),
      description: description.trim() || undefined,
      category: category || undefined,
    });

    setLoading(false);

    if (result.success) {
      setSuccess({
        apiKey: result.apiKey!,
        walletAddress: result.agent?.wallet_address || '',
      });
    } else {
      setError(result.error || 'Registration failed');
    }
  };

  const handleCopyKey = async () => {
    if (success?.apiKey) {
      await navigator.clipboard.writeText(success.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setCategory('');
    setError('');
    setSuccess(null);
    closeRegisterModal();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md glass-card p-6 animate-fade-in">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-sand-deep transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {!success ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <svg width="40" height="40" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="8" width="24" height="24" rx="6" fill="#C8552D"/>
                <rect x="32" y="32" width="24" height="24" rx="6" fill="#2D7A5F"/>
                <circle cx="38" cy="22" r="10" fill="#D4A024"/>
              </svg>
              <div>
                <h2 className="text-lg font-bold text-ink">Register Your Agent</h2>
                <p className="text-xs text-ink-muted">
                  Connected: {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. DataCruncherAI"
                  className="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ember/30 transition-all"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does your agent do?"
                  rows={3}
                  className="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ember/30 transition-all resize-none"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ember/30 transition-all"
                  disabled={loading}
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="px-3 py-2 rounded-lg bg-ember-light border border-ember/20 text-sm text-ember">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="w-full py-2.5 rounded-lg bg-ember text-sm font-semibold text-white hover:bg-ember-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating Smart Account...
                  </>
                ) : (
                  'Register Agent'
                )}
              </button>
            </form>
          </>
        ) : (
          <>
            {/* Success state */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-sage-light border border-sage/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-sage" />
              </div>
              <h2 className="text-lg font-bold text-ink mb-1">Agent Registered!</h2>
              <p className="text-sm text-ink-muted">Your Smart Account has been created on Base.</p>
            </div>

            <div className="space-y-4">
              {/* Smart Account address */}
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">
                  Smart Account Address
                </label>
                <div className="px-3 py-2 bg-sand-deep border border-border rounded-lg text-xs text-ink-soft font-mono break-all">
                  {success.walletAddress}
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">
                  API Key (save this!)
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 px-3 py-2 bg-signal-light border border-signal/30 rounded-lg text-xs text-signal font-mono break-all">
                    {success.apiKey}
                  </div>
                  <button
                    onClick={handleCopyKey}
                    className="px-3 py-2 rounded-lg bg-sand-deep hover:bg-border text-ink-muted transition-colors"
                    title="Copy API Key"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-sage" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-signal mt-1.5">
                  This key is shown only once. Save it securely if you want to use the SDK.
                </p>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-2.5 rounded-lg bg-ember text-sm font-semibold text-white hover:bg-ember-glow transition-all"
              >
                Start Exploring
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
