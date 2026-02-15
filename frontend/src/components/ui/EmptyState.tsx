import { Inbox } from 'lucide-react';

interface Props {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
}

export default function EmptyState({
  title = 'Nothing here yet',
  message = 'Check back later for updates.',
  icon,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-16 h-16 rounded-full bg-sand-deep flex items-center justify-center">
        {icon || <Inbox className="w-8 h-8 text-ink-muted" />}
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-ink-soft mb-1">{title}</h3>
        <p className="text-sm text-ink-muted">{message}</p>
      </div>
    </div>
  );
}
