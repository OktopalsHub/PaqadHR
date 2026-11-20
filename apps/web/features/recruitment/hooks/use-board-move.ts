'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  type MoveStageEmail,
  moveCandidateToStage,
  type PipelineStage,
} from '@/lib/api/recruitment-ats';
import { queryKeys } from '@/lib/query/keys';
import {
  applyOptimisticUpdate,
  isLastInFlightMutation,
  patchListItem,
} from '@/lib/query/optimistic';
import type { Candidate, CandidateStatus } from '@/lib/schemas/recruitment';
import { useTenant } from '@/providers/tenant-provider';

import type { BoardCandidate } from '../components/board/recruitment-kanban-board';
import { useAskEmailOnMove } from './use-ask-email-on-move';
import { useEmailTemplates } from './use-recruitment-ats';

export type PendingMove = {
  candidate: BoardCandidate;
  status: CandidateStatus;
  stage: PipelineStage;
};

export function useBoardMove(jobId: string | null) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { data: templates = [] } = useEmailTemplates();
  const [askBeforeEmail] = useAskEmailOnMove();
  const [pending, setPending] = useState<PendingMove | null>(null);
  const mutationKey = ['recruitment', 'board-move'] as const;

  const mutation = useMutation({
    mutationKey,
    mutationFn: (input: {
      candidateId: string;
      stageId: string;
      status: CandidateStatus;
      email: MoveStageEmail;
    }) => moveCandidateToStage(input.candidateId, input.stageId, input.email),
    onMutate: async ({ candidateId, stageId, status }) => {
      const rollbacks = await Promise.all(
        [
          [...queryKeys.recruitment.allCandidates, tenantId],
          ['recruitment', 'candidates'],
        ].map((queryKey) =>
          applyOptimisticUpdate<unknown>(queryClient, queryKey, (data) =>
            patchListItem<Candidate>(data, candidateId, { status, stageId }),
          ),
        ),
      );
      return {
        rollback: () => {
          for (const rollback of rollbacks) rollback();
        },
      };
    },
    onError: (error, _input, context) => {
      context?.rollback();
      toast.error(error instanceof Error ? error.message : 'Failed to move candidate');
    },
    onSettled: (_data, _error, input) => {
      if (!isLastInFlightMutation(queryClient, mutationKey)) return;
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.recruitment.allCandidates, tenantId],
      });
      void queryClient.invalidateQueries({ queryKey: ['recruitment', 'candidates'] });
      void queryClient.invalidateQueries({
        queryKey: ['recruitment', 'timeline', input.candidateId],
      });
      if (jobId) {
        void queryClient.invalidateQueries({
          queryKey: [...queryKeys.recruitment.candidates(jobId), tenantId],
        });
      }
    },
  });

  const confirm = (move: PendingMove, email: MoveStageEmail) => {
    setPending(null);
    mutation.mutate({
      candidateId: move.candidate.id,
      stageId: move.stage.id,
      status: move.status,
      email,
    });
  };

  const request = (candidate: BoardCandidate, stage: PipelineStage) => {
    const move = { candidate, status: stage.type as CandidateStatus, stage };
    if (askBeforeEmail && templates.some((template) => template.isActive)) {
      setPending(move);
      return;
    }
    confirm(move, {});
  };

  return {
    request,
    pending,
    cancel: () => setPending(null),
    confirm,
    templates,
    isMoving: mutation.isPending,
  };
}
