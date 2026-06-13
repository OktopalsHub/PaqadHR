"use client";

import { motion } from "framer-motion";
import { scaleIn } from "@/features/home/constants/landing-motion";
import { RecruitmentBoardFrame } from "@/features/recruitment/components/board/recruitment-board-frame";
import { RecruitmentBoardToolbar } from "@/features/recruitment/components/board/recruitment-board-toolbar";
import { RecruitmentKanbanColumn } from "@/features/recruitment/components/board/recruitment-kanban-column";
import {
  BOARD_COLUMNS,
  type BoardColumnId,
} from "@/features/recruitment/components/board/board-columns";
import { MOCK_CANDIDATES, MOCK_JOB } from "@/features/recruitment/components/board/board-mock-data";

export function LandingRecruitmentBoardMockup() {
  const grouped = BOARD_COLUMNS.reduce<
    Record<BoardColumnId, typeof MOCK_CANDIDATES>
  >(
    (acc, column) => {
      acc[column.id] = MOCK_CANDIDATES.filter(
        (candidate) => candidate.columnId === column.id,
      );
      return acc;
    },
    { applied: [], review: [], interview: [], hiring: [] },
  );

  return (
    <motion.div
      className="relative mx-auto mt-12 max-w-6xl px-6 md:mt-16"
      initial="hidden"
      animate="show"
      variants={scaleIn}
    >
      <RecruitmentBoardFrame variant="marketing">
        <RecruitmentBoardToolbar
          description={MOCK_JOB.description}
          qualifiedCount={MOCK_JOB.qualified}
          disqualifiedCount={MOCK_JOB.disqualified}
          showActions
        />

        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {BOARD_COLUMNS.map((column) => (
            <RecruitmentKanbanColumn
              key={column.id}
              title={column.title}
              count={grouped[column.id].length}
              candidates={grouped[column.id]}
              showAdd
            />
          ))}
        </div>
      </RecruitmentBoardFrame>
    </motion.div>
  );
}
