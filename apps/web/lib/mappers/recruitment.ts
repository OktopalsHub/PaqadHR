import { formatDisplayName } from '@/lib/format-name';
import type { Candidate, CandidateSource, CandidateStatus } from '@/lib/schemas/recruitment';

type ApiCandidate = {
  id: string;
  jobOpeningId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status: string;
  source?: string;
  skills?: string;
  resume?: {
    filename?: string;
    url?: string;
  };
  appliedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export function mapApiCandidate(candidate: ApiCandidate): Candidate {
  return {
    id: candidate.id,
    jobOpeningId: candidate.jobOpeningId,
    firstName: formatDisplayName(candidate.firstName, ''),
    lastName: formatDisplayName(candidate.lastName, ''),
    email: candidate.email,
    phone: candidate.phone ?? undefined,
    status: candidate.status as CandidateStatus,
    source: candidate.source as CandidateSource | undefined,
    skills: candidate.skills,
    resume: candidate.resume,
    appliedAt: candidate.appliedAt ?? candidate.createdAt,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };
}

export function mapApiCandidates(candidates: ApiCandidate[]): Candidate[] {
  return candidates.map(mapApiCandidate);
}
