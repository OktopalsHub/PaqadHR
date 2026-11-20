import type { CandidateStatus } from '../components/board/board-columns';
import { canTransition } from '../components/board/board-columns';

type StageLike = { id: string; type: string };
type CandidateLike = { id: string; status: CandidateStatus; stageId?: string | null };

export function effectiveStageId<S extends StageLike>(
  stages: S[],
  candidate: CandidateLike,
): string | null {
  if (candidate.stageId && stages.some((stage) => stage.id === candidate.stageId)) {
    return candidate.stageId;
  }
  return stages.find((stage) => stage.type === candidate.status)?.id ?? stages[0]?.id ?? null;
}

export function groupByStage<S extends StageLike, C extends CandidateLike>(
  stages: S[],
  candidates: C[],
): Record<string, C[]> {
  const grouped: Record<string, C[]> = Object.fromEntries(stages.map((stage) => [stage.id, []]));
  for (const candidate of candidates) {
    const stageId = effectiveStageId(stages, candidate);
    if (stageId) grouped[stageId].push(candidate);
  }
  return grouped;
}

export type StageDrop = { type: 'noop' } | { type: 'move' } | { type: 'invalid' };

export function resolveStageDrop<S extends StageLike>(
  stages: S[],
  candidate: CandidateLike,
  target: S,
): StageDrop {
  if (effectiveStageId(stages, candidate) === target.id) return { type: 'noop' };
  if (target.type === candidate.status) return { type: 'move' };
  return canTransition(candidate.status, target.type as CandidateStatus)
    ? { type: 'move' }
    : { type: 'invalid' };
}
