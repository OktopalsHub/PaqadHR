"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppPage } from "@/components/app-page";
import { LoadingBlock } from "@/components/loading-block";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  useCandidatesByJob,
  useJobOpening,
  useUpdateCandidateStatus,
} from "@/hooks/queries/use-recruitment";
import { useBreadcrumbTail } from "@/providers/breadcrumb-provider";
import type { Candidate, CandidateStatus } from "@/lib/schemas/recruitment";
import { RecruitmentBoardToolbar } from "./board/recruitment-board-toolbar";
import { RecruitmentCandidateList } from "./board/recruitment-candidate-list";
import {
  RecruitmentViewToggle,
  type RecruitmentViewMode,
} from "./board/recruitment-view-toggle";
import {
  demoCandidatesForJob,
  isDemoCandidateId,
} from "./board/board-mock-data";
import {
  RecruitmentKanbanBoard,
  candidatesToBoardData,
} from "./board/recruitment-kanban-board";
import { isDisqualified } from "./board/board-columns";

type RecruitmentBoardPageProps = {
  jobId: string;
};

const PREVIEW_JOB_ID = "preview";

export function RecruitmentBoardPage({ jobId }: RecruitmentBoardPageProps) {
  const isPreviewJob = jobId === PREVIEW_JOB_ID;
  const [search, setSearch] = useState("");
  const [view, setView] = useState<RecruitmentViewMode>("kanban");
  const [demoCandidates, setDemoCandidates] = useState<Candidate[] | null>(
    null,
  );

  const { data: job, isLoading: jobLoading, isError: jobError } =
    useJobOpening(isPreviewJob ? null : jobId);
  const {
    data: apiCandidates = [],
    isLoading: candidatesLoading,
    isError: candidatesError,
  } = useCandidatesByJob(isPreviewJob ? null : jobId);
  const updateStatus = useUpdateCandidateStatus(isPreviewJob ? null : jobId);

  const previewJob = {
    title: "Product Designer",
    description:
      "Professional responsible for creating experience product.",
  };

  useBreadcrumbTail(isPreviewJob ? previewJob.title : (job?.title ?? null));

  const hasLiveCandidates = !candidatesError && apiCandidates.length > 0;
  const isPreview = isPreviewJob || !hasLiveCandidates;

  useEffect(() => {
    if (isPreview) {
      setDemoCandidates(demoCandidatesForJob(jobId));
    } else {
      setDemoCandidates(null);
    }
  }, [isPreview, jobId]);

  const candidates = useMemo(() => {
    if (!isPreview) return apiCandidates;
    return demoCandidates ?? demoCandidatesForJob(jobId);
  }, [isPreview, apiCandidates, demoCandidates, jobId]);

  const boardCandidates = useMemo(() => {
    const items = candidatesToBoardData(candidates);
    const term = search.trim().toLowerCase();
    if (!term) return items;

    return items.filter((candidate) => {
      const haystack =
        `${candidate.firstName} ${candidate.lastName} ${candidate.email} ${candidate.summary ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [candidates, search]);

  const qualifiedCount = candidates.filter(
    (candidate) => !isDisqualified(candidate.status),
  ).length;
  const disqualifiedCount = candidates.filter((candidate) =>
    isDisqualified(candidate.status),
  ).length;

  const handleMoveCandidate = async (
    candidateId: string,
    status: CandidateStatus,
  ) => {
    if (isPreview || isDemoCandidateId(candidateId)) {
      setDemoCandidates((prev) => {
        const base = prev ?? demoCandidatesForJob(jobId);
        return base.map((candidate) =>
          candidate.id === candidateId ? { ...candidate, status } : candidate,
        );
      });
      return;
    }

    try {
      await updateStatus.mutateAsync({ candidateId, status });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update candidate",
      );
    }
  };

  if (jobLoading || candidatesLoading) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  const boardJob = isPreviewJob ? previewJob : job!;

  if (!isPreviewJob && (jobError || !job)) {
    return (
      <AppPage>
        <Alert variant="destructive">
          <AlertTitle>Unable to load recruitment board</AlertTitle>
          <AlertDescription>
            Could not load this job opening. Go back to Recruitment and try
            again.
          </AlertDescription>
        </Alert>
      </AppPage>
    );
  }

  return (
    <AppPage className="space-y-4">
      {isPreview ? (
        <Alert className="border-border/60 bg-muted/30">
          <AlertTitle className="text-sm">Preview data</AlertTitle>
          <AlertDescription className="text-xs">
            {candidatesError
              ? "Could not load candidates from the server. Showing sample pipeline data instead."
              : "No candidates yet for this role. Showing sample pipeline data — real applications will replace this automatically."}
          </AlertDescription>
        </Alert>
      ) : null}

      <RecruitmentBoardToolbar
        description={boardJob.description}
        qualifiedCount={qualifiedCount}
        disqualifiedCount={disqualifiedCount}
        search={search}
        onSearchChange={setSearch}
        viewToggle={
          <RecruitmentViewToggle view={view} onViewChange={setView} />
        }
      />

      {view === "kanban" ? (
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
