export type BoardColumnId = 'applied' | 'review' | 'interview' | 'hiring';

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
];

export const DISQUALIFIED_STATUSES: CandidateStatus[] = ['REJECTED', 'WITHDRAWN'];

export function columnForStatus(status: CandidateStatus): BoardColumnId {
  const column = BOARD_COLUMNS.find((col) => col.statuses.includes(status));
  return column?.id ?? 'applied';
}

export function isDisqualified(status: CandidateStatus) {
  return DISQUALIFIED_STATUSES.includes(status);
}
