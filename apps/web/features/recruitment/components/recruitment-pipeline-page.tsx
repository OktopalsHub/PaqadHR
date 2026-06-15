"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppPage } from "@/components/app-page";
import { LoadingBlock } from "@/components/loading-block";
import { PageActions } from "@/components/page-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  useAllCandidates,
  useUpdateCandidateStatus,
} from "@/hooks/queries/use-recruitment";
import type { CandidateStatus } from "@/lib/schemas/recruitment";
import { useTenantHref } from "@/hooks/use-tenant-nav-items";
import { AddCandidateDialog } from "./add-candidate-dialog";
import { RecruitmentBoardToolbar } from "./board/recruitment-board-toolbar";
import { RecruitmentCandidateList } from "./board/recruitment-candidate-list";
import {
  RecruitmentViewToggle,
  type RecruitmentViewMode,
} from "./board/recruitment-view-toggle";
import {
  RecruitmentKanbanBoard,
  candidatesToBoardData,
} from "./board/recruitment-kanban-board";
import { isDisqualified } from "./board/board-columns";

export function RecruitmentPipelinePage() {
  const tenantHref = useTenantHref();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<RecruitmentViewMode>("kanban");
  const [addOpen, setAddOpen] = useState(false);

  const {
    data: candidates = [],
    isLoading,
    isError,
  } = useAllCandidates();
  const updateStatus = useUpdateCandidateStatus(null);

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
    try {
      await updateStatus.mutateAsync({ candidateId, status });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update candidate",
      );
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
    <AppPage className="space-y-4">
      <PageActions>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-xs"
          asChild
        >
          <Link href={tenantHref("recruitment/roles")}>
            <BarChart3 className="mr-1.5 size-3.5" />
            Roles & analytics
          </Link>
        </Button>
        <Button
          size="sm"
          className="h-8 rounded-lg text-xs"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="mr-1.5 size-3.5" />
          Add candidate
        </Button>
      </PageActions>

      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load pipeline</AlertTitle>
          <AlertDescription>
            Could not load candidates. Try refreshing the page.
          </AlertDescription>
        </Alert>
      ) : null}

      <RecruitmentBoardToolbar
        title="Candidate pipeline"
        description="Manage your candidate pipeline. Job postings are optional — use Roles & analytics when you publish openings."
        qualifiedCount={qualifiedCount}
        disqualifiedCount={disqualifiedCount}
        search={search}
        onSearchChange={setSearch}
        viewToggle={
          <RecruitmentViewToggle view={view} onViewChange={setView} />
        }
      />

      {candidates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-6 py-12 text-center">
          <p className="text-sm font-medium">No candidates yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add your first candidate, or publish a role under Roles & analytics
            for public applications.
          </p>
          <Button
            size="sm"
            className="mt-4 h-8 rounded-lg text-xs"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-1.5 size-3.5" />
            Add candidate
          </Button>
        </div>
      ) : view === "kanban" ? (
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
