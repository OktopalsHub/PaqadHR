import { CalendarDays } from 'lucide-react';
import { ContentCard } from '@/components/content-card';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type DemoLeaveRequest, demoLeaveRequests } from '../../../constants/landing-demo-data';

type LeavesDemoViewProps = {
  compact?: boolean;
};

function statusVariant(status: DemoLeaveRequest['status']) {
  switch (status) {
    case 'approved':
      return 'default' as const;
    case 'pending':
      return 'secondary' as const;
    default:
      return 'destructive' as const;
  }
}

export function LeavesDemoView({ compact }: LeavesDemoViewProps) {
  const pending = demoLeaveRequests.filter((r) => r.status === 'pending').length;
  const approved = demoLeaveRequests.filter((r) => r.status === 'approved').length;

  return (
    <div className={cn('space-y-4 p-4', compact && 'p-3')}>
      {!compact ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <StatCard
            label="Pending requests"
            value={pending}
            hint="Needs your review"
            icon={CalendarDays}
            className="p-3"
          />
          <StatCard
            label="Approved this month"
            value={approved}
            hint="Across all types"
            icon={CalendarDays}
            className="p-3"
          />
          <StatCard
            label="Team on leave today"
            value={1}
            hint="James — sick leave"
            icon={CalendarDays}
            className="p-3"
          />
        </div>
      ) : null}

      <ContentCard title="Leave requests" className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="px-4 py-2 font-medium">Employee</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Dates</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {demoLeaveRequests.map((request) => (
                <tr key={request.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{request.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{request.type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{request.dates}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(request.status)} className="capitalize">
                      {request.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ContentCard>
    </div>
  );
}
