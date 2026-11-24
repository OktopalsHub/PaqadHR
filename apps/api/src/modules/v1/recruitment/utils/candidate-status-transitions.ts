import { BadRequestException } from '@nestjs/common';
import { CandidateStatus } from 'src/common/enums';

const ALLOWED_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  [CandidateStatus.APPLIED]: [
    CandidateStatus.SCREENING,
    CandidateStatus.UNDER_REVIEW,
    CandidateStatus.REJECTED,
    CandidateStatus.WITHDRAWN,
  ],
  [CandidateStatus.SCREENING]: [
    CandidateStatus.UNDER_REVIEW,
    CandidateStatus.INTERVIEW,
    CandidateStatus.REJECTED,
    CandidateStatus.WITHDRAWN,
  ],
  [CandidateStatus.UNDER_REVIEW]: [
    CandidateStatus.SCREENING,
    CandidateStatus.INTERVIEW,
    CandidateStatus.REJECTED,
    CandidateStatus.WITHDRAWN,
  ],
  [CandidateStatus.INTERVIEW]: [
    CandidateStatus.OFFER,
    CandidateStatus.REJECTED,
    CandidateStatus.WITHDRAWN,
  ],
  [CandidateStatus.OFFER]: [
    CandidateStatus.HIRED,
    CandidateStatus.REJECTED,
    CandidateStatus.WITHDRAWN,
  ],
  [CandidateStatus.HIRED]: [],
  [CandidateStatus.REJECTED]: [],
  [CandidateStatus.WITHDRAWN]: [],
};

export function assertCandidateTransition(from: CandidateStatus, to: CandidateStatus): void {
  if (from !== to && !ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new BadRequestException(`Cannot move candidate from ${from} to ${to}`);
  }
}
