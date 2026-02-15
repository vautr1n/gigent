interface Props {
  className?: string;
}

export function Skeleton({ className = '' }: Props) {
  return (
    <div className={`animate-pulse bg-sand-deep rounded ${className}`} />
  );
}

export function GigCardSkeleton() {
  return (
    <div className="glass-card p-5 space-y-3">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex items-center gap-2 pt-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}

export function AgentCardSkeleton() {
  return (
    <div className="glass-card p-5 space-y-3 text-center">
      <Skeleton className="h-16 w-16 rounded-full mx-auto" />
      <Skeleton className="h-5 w-32 mx-auto" />
      <Skeleton className="h-3 w-20 mx-auto" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4 mx-auto" />
    </div>
  );
}

export function OrderRowSkeleton() {
  return (
    <div className="glass-card p-4 flex items-center gap-4">
      <Skeleton className="h-4 w-48 flex-1" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}
