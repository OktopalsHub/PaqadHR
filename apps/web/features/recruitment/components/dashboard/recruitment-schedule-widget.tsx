'use client';

import Link from 'next/link';
import { ContentCard } from '@/components/content-card';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { cn } from '@/lib/utils';
import type { ScheduleEvent } from '../../lib/recruitment-types';

const TYPE_COLORS: Record<ScheduleEvent['type'], string> = {
  meeting: 'border-l-primary bg-primary/5',
  review: 'border-l-chart-2 bg-chart-2/10',
  leave: 'border-l-chart-3 bg-chart-3/10',
  holiday: 'border-l-muted-foreground bg-muted/30',
  celebration: 'border-l-chart-4 bg-chart-4/10',
};

type RecruitmentScheduleWidgetProps = {
  events: ScheduleEvent[];
};

export function RecruitmentScheduleWidget({ events }: RecruitmentScheduleWidgetProps) {
  const tenantHref = useTenantHref();

  return (
    <ContentCard
      title="Schedule"
      className="dashboard-panel rounded-[8px]"
      headerClassName="border-b border-[#d7e3f6] px-5 py-4 dark:border-slate-800"
      titleClassName="text-[17px] font-semibold text-slate-950 dark:text-slate-100"
      action={
        <Link href={tenantHref('calendar')} className="dashboard-link text-xs font-semibold">
          View all
        </Link>
      }
      bodyClassName="space-y-3 p-5"
    >
      {events.length === 0 ? (
        <div className="flex min-h-[160px] items-center justify-center text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No events scheduled for today.
          </p>
        </div>
      ) : (
        events.map((event) => (
          <div
            key={event.id}
            className={cn('rounded-[8px] border border-l-4 px-4 py-3', TYPE_COLORS[event.type])}
          >
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{event.time}</p>
            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
              {event.title}
            </p>
          </div>
        ))
      )}
    </ContentCard>
  );
}
