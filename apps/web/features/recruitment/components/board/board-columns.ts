export type CandidateStatus =
  | 'APPLIED'
  | 'SCREENING'
  | 'UNDER_REVIEW'
  | 'INTERVIEW'
  | 'OFFER'
  | 'HIRED'
  | 'REJECTED'
  | 'WITHDRAWN';

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

export function canTransition(from: CandidateStatus, to: CandidateStatus) {
  return CANDIDATE_STATUS_TRANSITIONS[from].includes(to);
}

export function canReject(status: CandidateStatus) {
  return CANDIDATE_STATUS_TRANSITIONS[status].includes('REJECTED');
}

export function isDisqualified(status: CandidateStatus) {
  return DISQUALIFIED_STATUSES.includes(status);
}
