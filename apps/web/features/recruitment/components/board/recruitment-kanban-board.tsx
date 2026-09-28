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
import { toast } from 'sonner';
import { DestructiveConfirmDialog } from '@/components/destructive-confirm-dialog';
import {
  BOARD_COLUMNS,
  type BoardColumnId,
  type CandidateStatus,
  canReject,
  columnForStatus,
  isDisqualified,
  resolveColumnDrop,
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
  onRejectCandidate,
}: {
  columnId: BoardColumnId;
  title: string;
  count: number;
  candidates: BoardCandidate[];
  interactive?: boolean;
  onRejectCandidate?: (candidate: BoardCandidate) => void;
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
            <SortableCard
              candidate={candidate as BoardCandidate}
              onRejectCandidate={onRejectCandidate}
            />
          ) : (
            <CandidateKanbanCard candidate={candidate} />
          )
        }
      />
    </div>
  );
}

function SortableCard({
  candidate,
  onRejectCandidate,
}: {
  candidate: BoardCandidate;
  onRejectCandidate?: (candidate: BoardCandidate) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: candidate.id,
    disabled: isDisqualified(candidate.status),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CandidateKanbanCard
        candidate={candidate}
        isDragging={isDragging}
        onReject={
          onRejectCandidate && canReject(candidate.status)
            ? () => onRejectCandidate(candidate)
            : undefined
        }
      />
    </div>
  );
}

export function RecruitmentKanbanBoard({
  candidates,
  interactive = false,
  onMoveCandidate,
}: RecruitmentKanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<BoardCandidate | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped = useMemo(() => {
    const map = Object.fromEntries(
      BOARD_COLUMNS.map((column) => [column.id, [] as BoardCandidate[]]),
    ) as Record<BoardColumnId, BoardCandidate[]>;

    for (const candidate of candidates) {
      map[columnForStatus(candidate.status)].push(candidate);
    }

    return map;
  }, [candidates]);

  const activeCandidate = candidates.find((c) => c.id === activeId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    if (!interactive || !onMoveCandidate) return;

    const { active, over } = event;
    if (!over) return;

    const candidateId = String(active.id);
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) return;

    const overId = String(over.id);
    const targetColumn =
      BOARD_COLUMNS.find((col) => col.id === overId) ??
      BOARD_COLUMNS.find((col) => grouped[col.id].some((item) => item.id === overId));

    if (!targetColumn) return;

    const resolution = resolveColumnDrop(candidate.status, targetColumn.id);

    if (resolution.type === 'move') {
      if (isDisqualified(resolution.status) && !isDisqualified(candidate.status)) {
        setRejectTarget(candidate);
        return;
      }
      onMoveCandidate(candidateId, resolution.status);
      return;
    }

    if (resolution.type === 'invalid') {
      toast.error(`Cannot move candidate from ${candidate.status} to ${resolution.status}`);
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
          onRejectCandidate={interactive && onMoveCandidate ? setRejectTarget : undefined}
        />
      ))}
    </div>
  );

  if (!interactive) {
    return columns;
  }

  const confirmReject = () => {
    if (rejectTarget) {
      onMoveCandidate?.(rejectTarget.id, 'REJECTED');
    }
    setRejectTarget(null);
  };

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
      <DestructiveConfirmDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
        title="Reject candidate?"
        description={
          rejectTarget
            ? `${`${rejectTarget.firstName} ${rejectTarget.lastName}`.trim()} will move to Disqualified. This is permanent — the candidate can no longer progress in this pipeline.`
            : ''
        }
        actionLabel="Reject candidate"
        onConfirm={confirmReject}
      />
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
