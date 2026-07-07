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
    <div className={cn('app-card flex w-[280px] shrink-0 flex-col rounded-[8px] p-3', className)}>
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#d7e3f6] px-1 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <span className="inline-flex min-w-7 items-center justify-center rounded-full border border-[#d7e3f6] bg-[#eef4ff] px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {count}
          </span>
        </div>
        {showAdd ? (
          <button
            type="button"
            className="rounded-[8px] border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:shadow-none dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label={`Add to ${title}`}
          >
            <Plus className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3">
        {candidates.length === 0 ? (
          <div className="dashboard-soft-tile flex min-h-[140px] items-center justify-center rounded-[8px] px-4 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
            No candidates
          </div>
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
