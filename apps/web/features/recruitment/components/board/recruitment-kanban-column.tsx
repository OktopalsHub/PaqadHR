import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { type CandidateCardData, CandidateKanbanCard } from './candidate-kanban-card';

type RecruitmentKanbanColumnProps = {
  title: string;
  count: number;
  candidates: CandidateCardData[];
  className?: string;
  renderCard?: (candidate: CandidateCardData) => ReactNode;
  showAdd?: boolean;
};

export function RecruitmentKanbanColumn({
  title,
  count,
  candidates,
  className,
  renderCard,
  showAdd = false,
}: RecruitmentKanbanColumnProps) {
  return (
    <div className={cn('flex w-[260px] shrink-0 flex-col rounded-xl bg-muted/40 p-2.5', className)}>
      <div className="mb-2.5 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold">{title}</h3>
          <span className="rounded-md bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {count}
          </span>
        </div>
        {showAdd ? (
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label={`Add to ${title}`}
          >
            <Plus className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {candidates.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">No candidates</p>
        ) : (
          candidates.map((candidate) =>
            renderCard ? (
              <div key={candidate.id}>{renderCard(candidate)}</div>
            ) : (
              <CandidateKanbanCard key={candidate.id} candidate={candidate} />
            ),
          )
        )}
      </div>
    </div>
  );
}
