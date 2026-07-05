'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMemo, useState } from 'react';
import {
  BOARD_COLUMNS,
  type BoardColumnId,
  type CandidateStatus,
  columnForStatus,
  isDisqualified,
} from './board-columns';
import { type CandidateCardData, CandidateKanbanCard } from './candidate-kanban-card';
import { RecruitmentKanbanColumn } from './recruitment-kanban-column';

export type BoardCandidate = CandidateCardData & {
  status: CandidateStatus;
};

type RecruitmentKanbanBoardProps = {
  candidates: BoardCandidate[];
  interactive?: boolean;
  onMoveCandidate?: (candidateId: string, status: CandidateStatus) => void;
};

function DroppableColumn({
  columnId,
  title,
  count,
  candidates,
  interactive,
}: {
  columnId: BoardColumnId;
  title: string;
  count: number;
  candidates: BoardCandidate[];
  interactive?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  return (
    <div
      ref={setNodeRef}
      className={
        isOver
          ? 'rounded-[8px] ring-2 ring-[#fbbf24]/35 ring-offset-2 ring-offset-transparent'
          : undefined
      }
    >
      <RecruitmentKanbanColumn
        title={title}
        count={count}
        candidates={candidates}
        showAdd={!interactive}
        renderCard={(candidate) =>
          interactive ? (
            <SortableCard candidate={candidate as BoardCandidate} />
          ) : (
            <CandidateKanbanCard candidate={candidate} />
          )
        }
      />
    </div>
  );
}

function SortableCard({ candidate }: { candidate: BoardCandidate }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: candidate.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CandidateKanbanCard candidate={candidate} isDragging={isDragging} />
    </div>
  );
}

export function RecruitmentKanbanBoard({
  candidates,
  interactive = false,
  onMoveCandidate,
}: RecruitmentKanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const activeCandidates = candidates.filter((c) => !isDisqualified(c.status));

  const grouped = useMemo(() => {
    const map: Record<BoardColumnId, BoardCandidate[]> = {
      applied: [],
      review: [],
      interview: [],
      hiring: [],
    };

    for (const candidate of activeCandidates) {
      const columnId = columnForStatus(candidate.status);
      map[columnId].push(candidate);
    }

    return map;
  }, [activeCandidates]);

  const activeCandidate = activeCandidates.find((c) => c.id === activeId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    if (!interactive || !onMoveCandidate) return;

    const { active, over } = event;
    if (!over) return;

    const candidateId = String(active.id);
    const candidate = activeCandidates.find((c) => c.id === candidateId);
    if (!candidate) return;

    const overId = String(over.id) as BoardColumnId | string;
    const targetColumn =
      BOARD_COLUMNS.find((col) => col.id === overId) ??
      BOARD_COLUMNS.find((col) => grouped[col.id].some((item) => item.id === overId));

    if (!targetColumn) return;

    if (candidate.status !== targetColumn.primaryStatus) {
      onMoveCandidate(candidateId, targetColumn.primaryStatus);
    }
  };

  const columns = (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {BOARD_COLUMNS.map((column) => (
        <DroppableColumn
          key={column.id}
          columnId={column.id}
          title={column.title}
          count={grouped[column.id].length}
          candidates={grouped[column.id]}
          interactive={interactive}
        />
      ))}
    </div>
  );

  if (!interactive) {
    return columns;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {columns}
      <DragOverlay>
        {activeCandidate ? <CandidateKanbanCard candidate={activeCandidate} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

export function candidatesToBoardData(
  candidates: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: CandidateStatus;
    skills?: string;
    resume?: { filename?: string };
  }>,
): BoardCandidate[] {
  return candidates.map((candidate) => ({
    id: candidate.id,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    email: candidate.email,
    status: candidate.status,
    summary: candidate.skills,
    fileCount: candidate.resume?.filename ? 1 : 0,
  }));
}
