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
import { LoadingBlock } from '@/components/loading-block';
import type { PipelineStage } from '@/lib/api/recruitment-ats';

import { usePipeline } from '../../hooks/use-recruitment-ats';
import { stageColor } from '../../lib/stage-colors';
import { groupByStage, resolveStageDrop } from '../../lib/stage-board';
import { type CandidateStatus, canReject, isDisqualified } from './board-columns';
import { type CandidateCardData, CandidateKanbanCard } from './candidate-kanban-card';
import { RecruitmentKanbanColumn } from './recruitment-kanban-column';

export type BoardCandidate = CandidateCardData & {
  status: CandidateStatus;
  stageId?: string | null;
};

type RecruitmentKanbanBoardProps = {
  candidates: BoardCandidate[];
  interactive?: boolean;
  onMoveCandidate?: (candidate: BoardCandidate, stage: PipelineStage) => void;
  onOpenCandidate?: (candidate: BoardCandidate) => void;
};

function DroppableColumn({
  stage,
  candidates,
  interactive,
  onRejectCandidate,
  onOpenCandidate,
}: {
  stage: PipelineStage;
  candidates: BoardCandidate[];
  interactive?: boolean;
  onRejectCandidate?: (candidate: BoardCandidate) => void;
  onOpenCandidate?: (candidate: BoardCandidate) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

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
        title={stage.name}
        color={stageColor(stage)}
        count={candidates.length}
        candidates={candidates}
        renderCard={(candidate) =>
          interactive ? (
            <SortableCard
              candidate={candidate as BoardCandidate}
              onRejectCandidate={onRejectCandidate}
              onOpenCandidate={onOpenCandidate}
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
  onOpenCandidate,
}: {
  candidate: BoardCandidate;
  onRejectCandidate?: (candidate: BoardCandidate) => void;
  onOpenCandidate?: (candidate: BoardCandidate) => void;
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
        onOpen={onOpenCandidate ? () => onOpenCandidate(candidate) : undefined}
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
  onOpenCandidate,
}: RecruitmentKanbanBoardProps) {
  const { data: stages = [], isLoading } = usePipeline();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<BoardCandidate | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped = useMemo(() => groupByStage(stages, candidates), [stages, candidates]);
  const rejectStage = stages.find((stage) => stage.type === 'REJECTED');
  const activeCandidate = candidates.find((c) => c.id === activeId);

  if (isLoading) return <LoadingBlock />;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    if (!interactive || !onMoveCandidate) return;

    const { active, over } = event;
    if (!over) return;

    const candidate = candidates.find((c) => c.id === String(active.id));
    if (!candidate) return;

    const overId = String(over.id);
    const target =
      stages.find((stage) => stage.id === overId) ??
      stages.find((stage) => grouped[stage.id]?.some((item) => item.id === overId));
    if (!target) return;

    const resolution = resolveStageDrop(stages, candidate, target);
    if (resolution.type === 'invalid') {
      toast.error(`Cannot move this candidate from ${candidate.status} to ${target.type}`);
      return;
    }
    if (resolution.type === 'noop') return;

    if (isDisqualified(target.type as CandidateStatus) && !isDisqualified(candidate.status)) {
      setRejectTarget(candidate);
      return;
    }
    onMoveCandidate(candidate, target);
  };

  const columns = (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {stages.map((stage) => (
        <DroppableColumn
          key={stage.id}
          stage={stage}
          candidates={grouped[stage.id] ?? []}
          interactive={interactive}
          onRejectCandidate={interactive && onMoveCandidate ? setRejectTarget : undefined}
          onOpenCandidate={onOpenCandidate}
        />
      ))}
    </div>
  );

  if (!interactive) {
    return columns;
  }

  const confirmReject = () => {
    if (rejectTarget && rejectStage) onMoveCandidate?.(rejectTarget, rejectStage);
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
            ? `${`${rejectTarget.firstName} ${rejectTarget.lastName}`.trim()} will move to ${rejectStage?.name ?? 'Rejected'}. This is permanent — the candidate can no longer progress in this pipeline.`
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
    stageId?: string | null;
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
    stageId: candidate.stageId ?? null,
    summary: candidate.skills,
    fileCount: candidate.resume?.filename ? 1 : 0,
  }));
}
