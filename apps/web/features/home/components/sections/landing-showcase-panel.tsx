import { cn } from '@/lib/utils';

type ShowcasePanelVariant = 'recruitment' | 'payroll' | 'culture';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('rounded-md bg-muted/70', className)} />;
}

export function LandingShowcasePanel({ variant }: { variant: ShowcasePanelVariant }) {
  if (variant === 'recruitment') {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xl shadow-black/20">
        <Skeleton className="h-3 w-24" />
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="space-y-2 rounded-lg border border-border/50 bg-background/40 p-3"
            >
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'payroll') {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xl shadow-black/20">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="mt-4 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xl shadow-black/20">
      <Skeleton className="h-3 w-32" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="space-y-2 rounded-lg border border-border/50 bg-background/40 p-3"
          >
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
