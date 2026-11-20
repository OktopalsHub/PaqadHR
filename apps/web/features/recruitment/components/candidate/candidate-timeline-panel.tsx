'use client';

import { useCandidateTimeline } from '../../hooks/use-candidate-ats';
import { usePipeline } from '../../hooks/use-recruitment-ats';

export function CandidateTimelinePanel({ candidateId }: { candidateId: string }) {
  const { data } = useCandidateTimeline(candidateId);
  const { data: stages = [] } = usePipeline();
  const stageName = (id: string | null) =>
    stages.find((stage) => stage.id === id)?.name ?? 'Unknown stage';

  const events = [
    ...(data?.stages ?? []).map((item) => ({
      id: item.id,
      at: item.createdAt,
      text: `Moved ${item.fromStageId ? `from ${stageName(item.fromStageId)} ` : ''}to ${stageName(item.toStageId)}`,
    })),
    ...(data?.emails ?? []).map((item) => ({
      id: item.id,
      at: item.createdAt,
      text: `Email “${item.subject}” ${item.status === 'sent' ? 'sent' : 'failed'}${item.trigger === 'stage' ? ' (automatic)' : ''}`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  if (events.length === 0) return <p className="text-sm text-slate-500">No activity yet.</p>;
  return (
    <ol className="space-y-3 text-sm">
      {events.map((event) => (
        <li key={event.id} className="border-l-2 pl-3">
          <p>{event.text}</p>
          <p className="text-xs text-slate-500">{new Date(event.at).toLocaleString()}</p>
        </li>
      ))}
    </ol>
  );
}
