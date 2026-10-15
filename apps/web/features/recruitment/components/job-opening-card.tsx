'use client';

import { ChevronRight, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { formatDate } from '@/lib/format-date';
import type { JobOpening } from '@/lib/schemas/recruitment';
import { cn } from '@/lib/utils';

function statusClassName(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/20 dark:text-green-300';
    case 'DRAFT':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300';
    case 'INACTIVE':
      return 'border-[#d7e3f6] bg-[#eef4ff] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
    case 'CLOSED':
    case 'ARCHIVED':
      return 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
    default:
      return 'border-[#d7e3f6] bg-[#eef4ff] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
  }
}

function formatStatus(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

export function JobOpeningCard({
  job,
  onSelectDetails,
}: {
  job: JobOpening;
  onSelectDetails?: (job: JobOpening) => void;
}) {
  const router = useRouter();
  const tenantHref = useTenantHref();

  return (
    <article className="relative">
      <button
        type="button"
        onClick={() => router.push(tenantHref(`recruitment/roles/${job.id}`))}
        className={cn(
          'app-card w-full cursor-pointer rounded-[8px] p-5 text-left transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-[#c7d7f1] hover:shadow-[0_18px_34px_-28px_rgba(71,95,140,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fbbf24]/50 dark:hover:border-slate-700 dark:hover:shadow-none',
          onSelectDetails && 'pr-16',
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-950 dark:text-slate-100">
                {job.title}
              </h3>
              {job.isUrgent ? (
                <Badge
                  variant="destructive"
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                >
                  Urgent
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {[job.departmentName, job.position, formatStatus(job.employmentType ?? '')]
                .filter(Boolean)
                .join(' · ') || 'No department'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'rounded-full px-3 py-1 text-[11px] font-semibold',
                statusClassName(job.status),
              )}
            >
              {formatStatus(job.status)}
            </Badge>
            <ChevronRight className="size-4 text-slate-400 dark:text-slate-500" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
          {job.numberOfOpenings != null ? (
            <span className="inline-flex items-center rounded-full border border-[#d7e3f6] bg-[#eef4ff] px-2.5 py-1 font-medium dark:border-slate-700 dark:bg-slate-900">
              {job.numberOfOpenings} opening{job.numberOfOpenings === 1 ? '' : 's'}
            </span>
          ) : null}
          {job.applicationDeadline ? (
            <span className="inline-flex items-center rounded-full border border-[#d7e3f6] bg-white px-2.5 py-1 font-medium dark:border-slate-700 dark:bg-slate-900">
              Closes {formatDate(job.applicationDeadline)}
            </span>
          ) : null}
          {job.publishedAt ? (
            <span className="inline-flex items-center rounded-full border border-[#d7e3f6] bg-white px-2.5 py-1 font-medium dark:border-slate-700 dark:bg-slate-900">
              Published {formatDate(job.publishedAt)}
            </span>
          ) : null}
        </div>
      </button>

      {onSelectDetails ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute top-5 right-5 z-10 size-8 shrink-0 rounded-[8px] border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:shadow-none dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label={`View details for ${job.title}`}
          onClick={() => onSelectDetails(job)}
        >
          <Info className="size-4" />
        </Button>
      ) : null}
    </article>
  );
}
