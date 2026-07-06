import { PersonAvatar } from '@/components/person-avatar';
import {
  AppTable,
  AppTableBodyRow,
  AppTableBodySection,
  AppTableCell,
  AppTableHeadCell,
  AppTableHeaderRow,
  AppTableHeaderSection,
  AppTablePanel,
} from '@/components/ui/app-table';
import type { CandidateStatus } from './board-columns';
import type { BoardCandidate } from './recruitment-kanban-board';

function formatStatus(status: CandidateStatus) {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function getCandidateStatusStyles(status: CandidateStatus) {
  switch (status) {
    case 'HIRED':
      return 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/20 dark:text-green-300';
    case 'OFFER':
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300';
    case 'INTERVIEW':
      return 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/20 dark:text-purple-300';
    case 'SCREENING':
    case 'UNDER_REVIEW':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300';
    case 'REJECTED':
    case 'WITHDRAWN':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300';
    default:
      return 'border-[#d7e3f6] bg-[#eef4ff] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
  }
}

function getCandidateStatusDotClass(status: CandidateStatus) {
  switch (status) {
    case 'HIRED':
      return 'bg-green-500';
    case 'OFFER':
      return 'bg-blue-500';
    case 'INTERVIEW':
      return 'bg-purple-500';
    case 'SCREENING':
    case 'UNDER_REVIEW':
      return 'bg-amber-500';
    case 'REJECTED':
    case 'WITHDRAWN':
      return 'bg-red-500';
    default:
      return 'bg-slate-400';
  }
}

function CandidateListRow({ candidate }: { candidate: BoardCandidate }) {
  const fullName = `${candidate.firstName} ${candidate.lastName}`.trim();

  return (
    <AppTableBodyRow>
      <AppTableCell>
        <div className="flex items-center gap-3">
          <PersonAvatar
            name={fullName}
            className="size-8 border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900"
            fallbackClassName="bg-slate-100 text-[10px] font-bold text-slate-800 dark:bg-slate-900 dark:text-slate-200"
          />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {fullName}
          </span>
        </div>
      </AppTableCell>
      <AppTableCell>{candidate.email}</AppTableCell>
      <AppTableCell>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getCandidateStatusStyles(
            candidate.status,
          )}`}
        >
          <span className={`size-2 rounded-full ${getCandidateStatusDotClass(candidate.status)}`} />
          {formatStatus(candidate.status)}
        </span>
      </AppTableCell>
      <AppTableCell className="max-w-[360px]">
        <span className="line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
          {candidate.summary || 'No notes provided'}
        </span>
      </AppTableCell>
      <AppTableCell>{candidate.fileCount ?? 0}</AppTableCell>
    </AppTableBodyRow>
  );
}

type RecruitmentCandidateListProps = {
  candidates: BoardCandidate[];
};

export function RecruitmentCandidateList({ candidates }: RecruitmentCandidateListProps) {
  return (
    <AppTablePanel>
      <AppTable className="min-w-[860px]">
        <AppTableHeaderSection>
          <AppTableHeaderRow>
            <AppTableHeadCell>Candidate</AppTableHeadCell>
            <AppTableHeadCell>Email</AppTableHeadCell>
            <AppTableHeadCell>Stage</AppTableHeadCell>
            <AppTableHeadCell>Notes</AppTableHeadCell>
            <AppTableHeadCell>Files</AppTableHeadCell>
          </AppTableHeaderRow>
        </AppTableHeaderSection>
        <AppTableBodySection>
          {candidates.length > 0 ? (
            candidates.map((candidate) => (
              <CandidateListRow key={candidate.id} candidate={candidate} />
            ))
          ) : (
            <AppTableBodyRow className="hover:bg-transparent">
              <AppTableCell
                colSpan={5}
                className="py-16 text-center text-sm text-slate-500 dark:text-slate-400"
              >
                No candidates match your search.
              </AppTableCell>
            </AppTableBodyRow>
          )}
        </AppTableBodySection>
      </AppTable>
    </AppTablePanel>
  );
}
