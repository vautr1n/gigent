import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ message, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="w-16 h-16 rounded-full bg-ember-light flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-ember" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-ink mb-1">Something went wrong</h3>
        <p className="text-sm text-ink-muted max-w-md">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sand-deep hover:bg-border text-ink text-sm font-medium transition-colors border border-border"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      )}
    </div>
  );
}
