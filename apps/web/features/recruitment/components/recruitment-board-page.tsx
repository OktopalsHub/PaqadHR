'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
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

  return (
    <AppPage className="space-y-4">
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
        description={job.description}
        qualifiedCount={qualifiedCount}
        disqualifiedCount={disqualifiedCount}
        search={search}
        onSearchChange={setSearch}
        viewToggle={<RecruitmentViewToggle view={view} onViewChange={setView} />}
      />

      {candidates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-6 py-12 text-center">
          <p className="text-sm font-medium">No candidates yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Applications for this role will appear here once candidates apply.
          </p>
        </div>
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
