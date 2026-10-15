import { Trophy } from 'lucide-react';
import { PAQ_POINTS_NAME } from '@/lib/constants/paq-points';

export function PointsSummaryCard({
  balance,
  totalEarned,
}: {
  balance: number;
  totalEarned: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 via-background to-primary/10 p-6 shadow-lg">
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary/5 blur-2xl" />
      <div className="relative flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
          <Trophy className="size-7" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{PAQ_POINTS_NAME} Balance</p>
          <p className="text-3xl font-bold tabular-nums text-foreground">
            {balance.toLocaleString()}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">Lifetime earned</p>
          <p className="text-lg font-semibold tabular-nums text-primary">
            {totalEarned.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
