'use client';

import { ChevronRight, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { formatDate } from '@/lib/format-date';
import type { JobOpening } from '@/lib/schemas/recruitment';

function statusVariant(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'DRAFT':
      return 'secondary';
    case 'CLOSED':
    case 'ARCHIVED':
      return 'outline';
    default:
      return 'outline';
  }
}

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
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
    <article
      onClick={() => router.push(tenantHref(`recruitment/roles/${job.id}`))}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          router.push(tenantHref(`recruitment/roles/${job.id}`));
        }
      }}
      className="rounded-lg border border-border/60 bg-muted/20 p-4 transition-colors hover:border-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{job.title}</h3>
            {job.isUrgent ? (
              <Badge variant="destructive" className="text-xs">
                Urgent
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {[job.departmentName, job.position, job.employmentType].filter(Boolean).join(' · ') ||
              'No department'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(job.status)}>{formatStatus(job.status)}</Badge>
          {onSelectDetails ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label={`View details for ${job.title}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectDetails(job);
              }}
            >
              <Info className="size-4" />
            </Button>
          ) : null}
          <ChevronRight className="size-4 text-muted-foreground" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {job.numberOfOpenings != null ? <span>{job.numberOfOpenings} opening(s)</span> : null}
        {job.applicationDeadline ? <span>Closes {formatDate(job.applicationDeadline)}</span> : null}
        {job.publishedAt ? <span>Published {formatDate(job.publishedAt)}</span> : null}
      </div>
    </article>
  );
}
