"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { scaleIn } from "@/features/home/constants/landing-motion";
import { Button } from "@/components/ui/button";
import { RecruitmentBoardFrame } from "@/features/recruitment/components/board/recruitment-board-frame";
import { RecruitmentBoardToolbar } from "@/features/recruitment/components/board/recruitment-board-toolbar";
import { RecruitmentCandidateList } from "@/features/recruitment/components/board/recruitment-candidate-list";
import {
  RecruitmentViewToggle,
  type RecruitmentViewMode,
} from "@/features/recruitment/components/board/recruitment-view-toggle";
import {
  DEFAULT_LANDING_JOB_ID,
  MOCK_JOBS,
  demoCandidatesForJob,
  getMockJob,
} from "@/features/recruitment/components/board/board-mock-data";
import { isDisqualified } from "@/features/recruitment/components/board/board-columns";
import {
  RecruitmentKanbanBoard,
  candidatesToBoardData,
} from "@/features/recruitment/components/board/recruitment-kanban-board";
import type { Candidate, CandidateStatus } from "@/lib/schemas/recruitment";

export function LandingRecruitmentBoardMockup() {
  const [activeJobId, setActiveJobId] = useState(DEFAULT_LANDING_JOB_ID);
  const [activeHref, setActiveHref] = useState("/app/recruitment");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<RecruitmentViewMode>("kanban");
  const [candidatesByJob, setCandidatesByJob] = useState<
    Record<string, Candidate[]>
  >(() =>
    Object.fromEntries(
      MOCK_JOBS.map((job) => [job.id, demoCandidatesForJob(job.id)]),
    ),
  );

  const activeJob = getMockJob(activeJobId);
  const candidates = candidatesByJob[activeJobId] ?? demoCandidatesForJob(activeJobId);

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

  const handleMoveCandidate = (
    candidateId: string,
    status: CandidateStatus,
  ) => {
    setCandidatesByJob((prev) => ({
      ...prev,
      [activeJobId]: (prev[activeJobId] ?? demoCandidatesForJob(activeJobId)).map(
        (candidate) =>
          candidate.id === candidateId ? { ...candidate, status } : candidate,
      ),
    }));
  };

  const handleNavSelect = (href: string, name: string) => {
    setActiveHref(href);

    if (href === "/app/recruitment") {
      return;
    }

    toast.info(`Sign up to explore ${name}`);
  };

  const handleJobChange = (jobId: string) => {
    setActiveJobId(jobId);
    setActiveHref("/app/recruitment");
    setSearch("");
  };

  return (
    <motion.div
      className="relative mx-auto mt-12 max-w-6xl px-6 md:mt-16"
      initial="hidden"
      animate="show"
      variants={scaleIn}
    >
      <RecruitmentBoardFrame
        variant="marketing"
        activeHref={activeHref}
        onNavSelect={handleNavSelect}
      >
        <RecruitmentBoardToolbar
          title={activeJob.title}
          titleAction={
            <div className="flex flex-wrap gap-1">
              {MOCK_JOBS.map((job) => (
                <Button
                  key={job.id}
                  type="button"
                  variant={job.id === activeJobId ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 rounded-lg px-2.5 text-xs"
                  onClick={() => handleJobChange(job.id)}
                >
                  {job.title}
                </Button>
              ))}
            </div>
          }
          description={activeJob.description}
          qualifiedCount={qualifiedCount}
          disqualifiedCount={disqualifiedCount}
          search={search}
          onSearchChange={setSearch}
          showActions
          viewToggle={
            <RecruitmentViewToggle view={view} onViewChange={setView} />
          }
        />

        <div className="mt-4">
          {view === "kanban" ? (
            <RecruitmentKanbanBoard
              candidates={boardCandidates}
              interactive
              onMoveCandidate={handleMoveCandidate}
            />
          ) : (
            <RecruitmentCandidateList candidates={boardCandidates} />
          )}
        </div>
      </RecruitmentBoardFrame>
    </motion.div>
  );
}
