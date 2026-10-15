export type BoardColumnId = 'applied' | 'review' | 'interview' | 'hiring' | 'disqualified';

export type CandidateStatus =
  | 'APPLIED'
  | 'SCREENING'
  | 'UNDER_REVIEW'
  | 'INTERVIEW'
  | 'OFFER'
  | 'HIRED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type BoardColumnConfig = {
  id: BoardColumnId;
  title: string;
  statuses: CandidateStatus[];
  primaryStatus: CandidateStatus;
};

export const BOARD_COLUMNS: BoardColumnConfig[] = [
  {
    id: 'applied',
    title: 'Applied',
    statuses: ['APPLIED'],
    primaryStatus: 'APPLIED',
  },
  {
    id: 'review',
    title: 'Review profile',
    statuses: ['SCREENING', 'UNDER_REVIEW'],
    primaryStatus: 'SCREENING',
  },
  {
    id: 'interview',
    title: 'Interview',
    statuses: ['INTERVIEW'],
    primaryStatus: 'INTERVIEW',
  },
  {
    id: 'hiring',
    title: 'Hiring',
    statuses: ['OFFER', 'HIRED'],
    primaryStatus: 'OFFER',
  },
  {
    id: 'disqualified',
    title: 'Disqualified',
    statuses: ['REJECTED', 'WITHDRAWN'],
    primaryStatus: 'REJECTED',
  },
];

export const DISQUALIFIED_STATUSES: CandidateStatus[] = ['REJECTED', 'WITHDRAWN'];

const CANDIDATE_STATUS_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  APPLIED: ['SCREENING', 'UNDER_REVIEW', 'REJECTED', 'WITHDRAWN'],
  SCREENING: ['UNDER_REVIEW', 'INTERVIEW', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW: ['SCREENING', 'INTERVIEW', 'REJECTED', 'WITHDRAWN'],
  INTERVIEW: ['OFFER', 'REJECTED', 'WITHDRAWN'],
  OFFER: ['HIRED', 'REJECTED', 'WITHDRAWN'],
  HIRED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export type ColumnDropResolution =
  | { type: 'noop' }
  | { type: 'move'; status: CandidateStatus }
  | { type: 'invalid'; status: CandidateStatus };

export function resolveColumnDrop(
  currentStatus: CandidateStatus,
  columnId: BoardColumnId,
): ColumnDropResolution {
  const column = BOARD_COLUMNS.find((col) => col.id === columnId);
  if (!column) {
    return { type: 'invalid', status: currentStatus };
  }
  if (column.statuses.includes(currentStatus)) {
    return { type: 'noop' };
  }
  const status = column.statuses.find((candidateStatus) =>
    CANDIDATE_STATUS_TRANSITIONS[currentStatus].includes(candidateStatus),
  );
  if (!status) {
    return { type: 'invalid', status: column.primaryStatus };
  }
  return { type: 'move', status };
}

export function canReject(status: CandidateStatus) {
  return CANDIDATE_STATUS_TRANSITIONS[status].includes('REJECTED');
}

export function columnForStatus(status: CandidateStatus): BoardColumnId {
  const column = BOARD_COLUMNS.find((col) => col.statuses.includes(status));
  return column?.id ?? 'applied';
}

export function isDisqualified(status: CandidateStatus) {
  return DISQUALIFIED_STATUSES.includes(status);
}
