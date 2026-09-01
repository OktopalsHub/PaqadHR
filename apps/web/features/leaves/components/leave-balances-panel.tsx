import { ContentCard } from '@/components/content-card';
import type { LeaveBalance } from '@/lib/schemas/leave';

type LeaveBalancesPanelProps = {
  balances: LeaveBalance[];
  className?: string;
};

export function LeaveBalancesPanel({ balances, className }: LeaveBalancesPanelProps) {
  if (balances.length === 0) return null;

  return (
    <ContentCard title="Your balances" className={className}>
      <ul className="space-y-3">
        {balances.map((balance) => (
          <li
            key={balance.leaveTypeId}
            className="dashboard-soft-tile flex items-center justify-between rounded-[8px] border border-[#d7e3f6] px-4 py-3 text-sm dark:border-slate-800"
          >
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {balance.leaveTypeName}
            </span>
            <span className="tabular-nums text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-950 dark:text-slate-100">
                {balance.remaining}
              </span>
              {' / '}
              {balance.allocated} days
            </span>
          </li>
        ))}
      </ul>
    </ContentCard>
  );
}
