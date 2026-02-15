import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center animate-fade-in">
      <div className="max-w-md mx-auto">
        <div className="text-8xl font-display font-extrabold text-gradient mb-4">404</div>
        <h1 className="text-2xl font-bold text-ink mb-3">Page Not Found</h1>
        <p className="text-ink-muted mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-ember hover:bg-ember-glow text-white font-semibold text-sm transition-all"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cream hover:bg-sand-deep text-ink font-semibold text-sm transition-all border border-border"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
