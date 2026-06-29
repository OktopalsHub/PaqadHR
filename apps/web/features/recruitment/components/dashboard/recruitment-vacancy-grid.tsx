'use client';

import { MapPin, Users } from 'lucide-react';
import Link from 'next/link';
import { ContentCard } from '@/components/content-card';
import { Badge } from '@/components/ui/badge';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import type { JobOpening } from '@/lib/schemas/recruitment';
import { formatEmploymentType } from '../../lib/recruitment-dashboard-metrics';

type RecruitmentVacancyGridProps = {
  jobs: JobOpening[];
  applicantCounts: Record<string, number>;
  onSelectDetails?: (job: JobOpening) => void;
};

function formatLocation(job: JobOpening) {
  if (!job.location) return '—';
  const parts = [job.location.type, job.location.city].filter(Boolean);
  return parts.join(' · ');
}

export function RecruitmentVacancyGrid({
  jobs,
  applicantCounts,
  onSelectDetails,
}: RecruitmentVacancyGridProps) {
  const tenantHref = useTenantHref();

  return (
    <ContentCard title="Current vacancies" bodyClassName="grid gap-3 sm:grid-cols-2">
      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open roles yet.</p>
      ) : (
        jobs.map((job) => (
          <Link
            key={job.id}
            href={tenantHref(`recruitment/roles/${job.id}`)}
            className="rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:border-primary/25"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium">{job.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatEmploymentType(job.employmentType)}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                <Users className="mr-1 size-3" />
                {applicantCounts[job.id] ?? 0}
              </Badge>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{formatLocation(job)}</span>
            </div>
            {onSelectDetails ? (
              <button
                type="button"
                className="mt-3 text-xs text-primary hover:underline"
                onClick={(event) => {
                  event.preventDefault();
                  onSelectDetails(job);
                }}
              >
                View details
              </button>
            ) : null}
          </Link>
        ))
      )}
    </ContentCard>
  );
}
