'use client';

import { Plus, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAllCandidates, useUpdateCandidateStatus } from '@/hooks/queries/use-recruitment';
import type { CandidateStatus } from '@/lib/schemas/recruitment';
import { AddCandidateDialog } from './add-candidate-dialog';
import { isDisqualified } from './board/board-columns';
import { RecruitmentBoardToolbar } from './board/recruitment-board-toolbar';
import { RecruitmentCandidateList } from './board/recruitment-candidate-list';
import { candidatesToBoardData, RecruitmentKanbanBoard } from './board/recruitment-kanban-board';
import { type RecruitmentViewMode, RecruitmentViewToggle } from './board/recruitment-view-toggle';
import { RecruitmentSectionTabs } from './recruitment-section-tabs';
import { ViewCareersPageLink } from './view-careers-page-link';

export function RecruitmentPipelinePage() {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<RecruitmentViewMode>('kanban');
  const [addOpen, setAddOpen] = useState(false);

  const { data: candidates = [], isLoading, isError } = useAllCandidates();
  const updateStatus = useUpdateCandidateStatus(null);

  const boardCandidates = useMemo(() => {
    const items = candidatesToBoardData(candidates);
    const term = search.trim().toLowerCase();
    if (!term) return items;

    return items.filter((candidate) => {
      const haystack =
        `${candidate.firstName} ${candidate.lastName} ${candidate.email} ${candidate.summary ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [candidates, search]);

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

  if (isLoading) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  return (
    <AppPage className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <RecruitmentSectionTabs active="pipeline" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-nowrap lg:justify-end">
          <ViewCareersPageLink />
          <Button
            variant="brandSolid"
            size="appCta"
            className="w-full normal-case tracking-normal text-sm sm:w-max"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="size-4" />
            Add candidate
          </Button>
        </div>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load pipeline</AlertTitle>
          <AlertDescription>Could not load candidates. Try refreshing the page.</AlertDescription>
        </Alert>
      ) : null}

      <RecruitmentBoardToolbar
        title="Candidate pipeline"
        description="Track applicants across every hiring stage and keep the process moving."
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
          description="Add your first candidate or publish a role to start receiving applications."
          action={
            <Button variant="brandSolid" size="app" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              Add candidate
            </Button>
          }
          className="min-h-[320px] border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/60"
        />
      ) : boardCandidates.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching candidates"
          description="Try a different search term to find applicants in the pipeline."
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

      <AddCandidateDialog open={addOpen} onOpenChange={setAddOpen} />
    </AppPage>
  );
}
