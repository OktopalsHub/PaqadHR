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
    <div
      className={cn(
        'flex h-full flex-col gap-3 bg-[#fbfdfc] p-4 font-montserrat dark:bg-[#0d1e19]',
        compact && 'p-3',
      )}
    >
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

      <ContentCard
        title="Leave requests"
        className="min-h-0 flex-1 border-[#e2ebe7] shadow-[0_8px_20px_-18px_rgba(23,60,50,0.5)] dark:border-[#25453a]"
        titleClassName="text-xs font-semibold"
        headerClassName="border-[#edf1ef] px-4 py-3 dark:border-[#25453a]"
        bodyClassName="p-0"
      >
        <div className="h-full overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f7faf8] dark:bg-[#173128]">
              <tr className="border-b border-[#edf1ef] text-muted-foreground dark:border-[#25453a]">
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
