import { ContentCard } from '@/components/content-card';
import type { LeaveBalance } from '@/lib/schemas/leave';

type LeaveBalancesPanelProps = {
  balances: LeaveBalance[];
};

export function LeaveBalancesPanel({ balances }: LeaveBalancesPanelProps) {
  if (balances.length === 0) return null;

  return (
    <ContentCard title="Your balances" description="Available leave by type">
      <ul className="space-y-3">
        {balances.map((balance) => (
          <li
            key={balance.leaveTypeId}
            className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm"
          >
            <span className="font-medium">{balance.leaveTypeName}</span>
            <span className="tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">{balance.remaining}</span>
              {' / '}
              {balance.allocated} days
            </span>
          </li>
        ))}
      </ul>
    </ContentCard>
  );
}
