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
    <ContentCard
      title="Current vacancies"
      className="dashboard-panel rounded-[8px]"
      headerClassName="border-b border-[#d7e3f6] px-5 py-4 dark:border-slate-800"
      titleClassName="text-[17px] font-semibold text-slate-950 dark:text-slate-100"
      bodyClassName="p-5"
    >
      {jobs.length === 0 ? (
        <div className="flex min-h-[160px] items-center justify-center text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">No open roles yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={tenantHref(`recruitment/roles/${job.id}`)}
              className="dashboard-soft-tile rounded-[8px] p-4 transition-colors hover:bg-white/80 dark:hover:bg-slate-900/80"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-medium text-slate-900 dark:text-slate-100">{job.title}</h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {formatEmploymentType(job.employmentType)}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="shrink-0 rounded-full border border-[#cad7ee] bg-white/80 text-[10px] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <Users className="mr-1 size-3" />
                  {applicantCounts[job.id] ?? 0}
                </Badge>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{formatLocation(job)}</span>
              </div>
              {onSelectDetails ? (
                <button
                  type="button"
                  className="dashboard-link mt-4 text-xs font-semibold"
                  onClick={(event) => {
                    event.preventDefault();
                    onSelectDetails(job);
                  }}
                >
                  View details
                </button>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </ContentCard>
  );
}
