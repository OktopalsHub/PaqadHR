'use client';

import { Search, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { PageActions } from '@/components/page-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  useCandidatesByJob,
  useJobOpening,
  useUpdateCandidateStatus,
} from '@/hooks/queries/use-recruitment';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import type { CandidateStatus } from '@/lib/schemas/recruitment';
import { useBreadcrumbTail } from '@/providers/breadcrumb-provider';
import { isDisqualified } from './board/board-columns';
import { RecruitmentBoardToolbar } from './board/recruitment-board-toolbar';
import { RecruitmentCandidateList } from './board/recruitment-candidate-list';
import { candidatesToBoardData, RecruitmentKanbanBoard } from './board/recruitment-kanban-board';
import { type RecruitmentViewMode, RecruitmentViewToggle } from './board/recruitment-view-toggle';
import { ViewCareersPageLink } from './view-careers-page-link';

type RecruitmentBoardPageProps = {
  jobId: string;
};

const PREVIEW_JOB_ID = 'preview';

function formatLabel(value?: string | null) {
  if (!value) return null;
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function getJobStatusClass(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/20 dark:text-green-300';
    case 'DRAFT':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300';
    case 'CLOSED':
      return 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
    case 'ARCHIVED':
      return 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400';
    default:
      return 'border-[#d7e3f6] bg-[#eef4ff] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
  }
}

export function RecruitmentBoardPage({ jobId }: RecruitmentBoardPageProps) {
  const router = useRouter();
  const tenantHref = useTenantHref();
  const isPreviewJob = jobId === PREVIEW_JOB_ID;
  const [search, setSearch] = useState('');
  const [view, setView] = useState<RecruitmentViewMode>('kanban');

  const {
    data: job,
    isLoading: jobLoading,
    isError: jobError,
  } = useJobOpening(isPreviewJob ? null : jobId);
  const {
    data: apiCandidates = [],
    isLoading: candidatesLoading,
    isError: candidatesError,
  } = useCandidatesByJob(isPreviewJob ? null : jobId);
  const updateStatus = useUpdateCandidateStatus(isPreviewJob ? null : jobId);

  useBreadcrumbTail(job?.title ?? null);

  useEffect(() => {
    if (isPreviewJob) {
      router.replace(tenantHref('recruitment'));
    }
  }, [isPreviewJob, router, tenantHref]);

  const boardCandidates = useMemo(() => {
    const items = candidatesToBoardData(apiCandidates);
    const term = search.trim().toLowerCase();
    if (!term) return items;

    return items.filter((candidate) => {
      const haystack =
        `${candidate.firstName} ${candidate.lastName} ${candidate.email} ${candidate.summary ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [apiCandidates, search]);

  if (isPreviewJob) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  const candidates = apiCandidates;

  const qualifiedCount = candidates.filter((candidate) => !isDisqualified(candidate.status)).length;
  const disqualifiedCount = candidates.filter((candidate) =>
    isDisqualified(candidate.status),
  ).length;

  const handleMoveCandidate = async (candidateId: string, status: CandidateStatus) => {
    try {
      await updateStatus.mutateAsync({ candidateId, status });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update candidate');
    }
  };

  if (jobLoading || candidatesLoading) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  if (jobError || !job) {
    return (
      <AppPage>
        <Alert variant="destructive">
          <AlertTitle>Unable to load recruitment board</AlertTitle>
          <AlertDescription>
            Could not load this job opening. Go back to Recruitment and try again.
          </AlertDescription>
        </Alert>
      </AppPage>
    );
  }

  const jobDescription =
    [
      job.departmentName,
      job.position,
      formatLabel(job.employmentType),
      formatLabel(job.location?.type),
    ]
      .filter(Boolean)
      .join(' • ') || 'Applications for this role appear here as candidates progress.';

  return (
    <AppPage className="mx-auto w-full max-w-7xl space-y-6">
      <PageActions>
        <ViewCareersPageLink />
      </PageActions>

      {candidatesError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load candidates</AlertTitle>
          <AlertDescription>
            Could not load candidates for this role. Try refreshing the page.
          </AlertDescription>
        </Alert>
      ) : null}

      <RecruitmentBoardToolbar
        title={job.title}
        titleAction={
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getJobStatusClass(
              job.status,
            )}`}
          >
            {formatLabel(job.status)}
          </span>
        }
        description={jobDescription}
        qualifiedCount={qualifiedCount}
        disqualifiedCount={disqualifiedCount}
        search={search}
        onSearchChange={setSearch}
        viewToggle={<RecruitmentViewToggle view={view} onViewChange={setView} />}
      />

      {candidates.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No candidates yet"
          description="Applications for this role will appear here once candidates apply."
          className="min-h-[320px] border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/60"
        />
      ) : boardCandidates.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching candidates"
          description="Try a different search term to find applicants for this role."
          className="min-h-[320px] border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/60"
        />
      ) : view === 'kanban' ? (
        <RecruitmentKanbanBoard
          candidates={boardCandidates}
          interactive
          onMoveCandidate={handleMoveCandidate}
        />
      ) : (
        <RecruitmentCandidateList candidates={boardCandidates} />
      )}
    </AppPage>
  );
}
