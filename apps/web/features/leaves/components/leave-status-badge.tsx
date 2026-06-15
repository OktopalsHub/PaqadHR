import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-700',
};

export function LeaveStatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();

  return (
    <span
      className={cn(
        'px-2 py-1 rounded-full text-xs capitalize',
        STATUS_STYLES[key] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {status}
    </span>
  );
}
