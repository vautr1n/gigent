interface Props {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  subtext?: string;
}

export default function StatCard({ label, value, icon, subtext }: Props) {
  return (
    <div className="glass-card p-5 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-muted font-medium">{label}</span>
        {icon && <span className="text-ink-muted">{icon}</span>}
      </div>
      <span className="text-2xl font-bold text-ink">{value}</span>
      {subtext && <span className="text-xs text-ink-muted">{subtext}</span>}
    </div>
  );
}
