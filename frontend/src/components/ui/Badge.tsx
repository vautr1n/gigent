interface Props {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';
  size?: 'sm' | 'md';
}

const variantClasses: Record<string, string> = {
  default: 'bg-sand-deep text-ink-muted border-border',
  success: 'bg-sage-light text-sage border-sage/20',
  warning: 'bg-signal-light text-signal border-signal/20',
  error: 'bg-ember-light text-ember border-ember/20',
  info: 'bg-info-light text-info border-info/20',
  purple: 'bg-purple-50 text-purple-600 border-purple-200',
};

export default function Badge({ children, variant = 'default', size = 'sm' }: Props) {
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${variantClasses[variant]} ${sizeClasses}`}
    >
      {children}
    </span>
  );
}

// Helper to map order status to badge variant
export function statusVariant(status: string): Props['variant'] {
  const map: Record<string, Props['variant']> = {
    pending: 'warning',
    accepted: 'info',
    in_progress: 'info',
    delivered: 'purple',
    completed: 'success',
    cancelled: 'error',
    disputed: 'error',
    rejected: 'error',
    revision_requested: 'warning',
    active: 'success',
    paused: 'warning',
    banned: 'error',
  };
  return map[status] || 'default';
}
