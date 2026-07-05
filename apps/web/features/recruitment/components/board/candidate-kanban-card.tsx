import { FileText, Percent } from 'lucide-react';
import { PersonAvatar } from '@/components/person-avatar';
import { cn } from '@/lib/utils';

export type CandidateCardData = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  summary?: string;
  fileCount?: number;
  matchScore?: number;
};

type CandidateKanbanCardProps = {
  candidate: CandidateCardData;
  className?: string;
  isDragging?: boolean;
};

export function CandidateKanbanCard({
  candidate,
  className,
  isDragging,
}: CandidateKanbanCardProps) {
  const fullName = `${candidate.firstName} ${candidate.lastName}`.trim();

  return (
    <article
      className={cn(
        'dashboard-soft-tile rounded-[8px] border border-[#d7e3f6] p-4 transition-[transform,box-shadow,border-color,background-color] hover:border-[#c7d7f1] hover:bg-white/90 hover:shadow-[0_18px_28px_-24px_rgba(71,95,140,0.4)] dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-900/90 dark:hover:shadow-none',
        isDragging &&
          'border-[#f6c24d] bg-white shadow-[0_18px_32px_-22px_rgba(245,158,11,0.38)] ring-2 ring-[#fbbf24]/35 dark:border-amber-500/60 dark:bg-slate-900 dark:shadow-none',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <PersonAvatar
          name={fullName}
          className="size-10 shrink-0 border border-[#d7e3f6] bg-white dark:border-slate-700 dark:bg-slate-900"
          fallbackClassName="bg-white text-[11px] font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {fullName}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{candidate.email}</p>
        </div>
      </div>

      {candidate.summary ? (
        <p className="mt-3 line-clamp-2 text-[13px] leading-5 text-slate-600 dark:text-slate-400">
          {candidate.summary}
        </p>
      ) : null}

      {(candidate.fileCount != null || candidate.matchScore != null) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
          {candidate.fileCount != null ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#d7e3f6] bg-white/80 px-2 py-1 font-medium dark:border-slate-700 dark:bg-slate-900/90">
              <FileText className="size-3" />
              {candidate.fileCount} file{candidate.fileCount === 1 ? '' : 's'}
            </span>
          ) : null}
          {candidate.matchScore != null ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#d7e3f6] bg-white/80 px-2 py-1 font-medium dark:border-slate-700 dark:bg-slate-900/90">
              <Percent className="size-3" />
              {candidate.matchScore}%
            </span>
          ) : null}
        </div>
      )}
    </article>
  );
}
