import type {
  Candidate,
  CandidateSource,
  CandidateStatus,
  JobOpening,
} from '@/lib/schemas/recruitment';

export type RecruitmentKpis = {
  applications: number;
  shortlisted: number;
  hired: number;
  rejected: number;
  trends: {
    applications?: { value: string; positive: boolean };
    shortlisted?: { value: string; positive: boolean };
    hired?: { value: string; positive: boolean };
    rejected?: { value: string; positive: boolean };
  };
};

export type ApplicationsChartPoint = {
  label: string;
  applied: number;
  shortlisted: number;
};

export type DepartmentChartPoint = {
  name: string;
  value: number;
};

export type SourceChartPoint = {
  name: string;
  value: number;
  source: CandidateSource;
};

export type ApplicantRow = {
  id: string;
  jobOpeningId?: string;
  name: string;
  email: string;
  role: string;
  date: string;
  employmentType: string;
  status: CandidateStatus;
};

const SHORTLISTED_STATUSES: CandidateStatus[] = ['SCREENING', 'UNDER_REVIEW', 'INTERVIEW', 'OFFER'];

const REJECTED_STATUSES: CandidateStatus[] = ['REJECTED', 'WITHDRAWN'];

const SOURCE_LABELS: Record<CandidateSource, string> = {
  INTERNAL: 'Employee referrals',
  PUBLIC_WEBSITE: 'Job boards',
  LINKEDIN: 'LinkedIn',
  INDEED: 'Indeed',
  OTHER: 'Other',
};

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function trendPercent(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) return undefined;
    return { value: '+100%', positive: true };
  }
  const change = ((current - previous) / previous) * 100;
  const positive = change >= 0;
  return {
    value: `${positive ? '+' : ''}${change.toFixed(2)}%`,
    positive,
  };
}

function countInRange(
  candidates: Candidate[],
  start: Date,
  end: Date,
  predicate: (c: Candidate) => boolean,
) {
  return candidates.filter((candidate) => {
    const applied = parseDate(candidate.appliedAt ?? candidate.createdAt);
    if (!applied) return false;
    return applied >= start && applied < end && predicate(candidate);
  }).length;
}

function computeTrends(candidates: Candidate[]): RecruitmentKpis['trends'] {
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(now.getDate() - 7);
  const previousStart = new Date(currentStart);
  previousStart.setDate(currentStart.getDate() - 7);

  const isApplication = (c: Candidate) => c.status !== 'WITHDRAWN';
  const isShortlisted = (c: Candidate) => SHORTLISTED_STATUSES.includes(c.status);
  const isHired = (c: Candidate) => c.status === 'HIRED';
  const isRejected = (c: Candidate) => REJECTED_STATUSES.includes(c.status);

  return {
    applications: trendPercent(
      countInRange(candidates, currentStart, now, isApplication),
      countInRange(candidates, previousStart, currentStart, isApplication),
    ),
    shortlisted: trendPercent(
      countInRange(candidates, currentStart, now, isShortlisted),
      countInRange(candidates, previousStart, currentStart, isShortlisted),
    ),
    hired: trendPercent(
      countInRange(candidates, currentStart, now, isHired),
      countInRange(candidates, previousStart, currentStart, isHired),
    ),
    rejected: trendPercent(
      countInRange(candidates, currentStart, now, isRejected),
      countInRange(candidates, previousStart, currentStart, isRejected),
    ),
  };
}

export function computeRecruitmentKpis(candidates: Candidate[]): RecruitmentKpis {
  const active = candidates.filter((c) => c.status !== 'WITHDRAWN');

  return {
    applications: active.length,
    shortlisted: active.filter((c) => SHORTLISTED_STATUSES.includes(c.status)).length,
    hired: active.filter((c) => c.status === 'HIRED').length,
    rejected: active.filter((c) => REJECTED_STATUSES.includes(c.status)).length,
    trends: computeTrends(candidates),
  };
}

export function computeApplicationsChart(candidates: Candidate[]): ApplicationsChartPoint[] {
  const points: ApplicationsChartPoint[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);

    const label = day.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });

    const dayCandidates = candidates.filter((candidate) => {
      const applied = parseDate(candidate.appliedAt ?? candidate.createdAt);
      return applied && applied >= day && applied < next;
    });

    points.push({
      label,
      applied: dayCandidates.length,
      shortlisted: dayCandidates.filter((c) => SHORTLISTED_STATUSES.includes(c.status)).length,
    });
  }

  return points;
}

export function computeDepartmentChart(
  candidates: Candidate[],
  jobs: JobOpening[],
): DepartmentChartPoint[] {
  const jobById = Object.fromEntries(jobs.map((job) => [job.id, job]));
  const counts = new Map<string, number>();

  for (const candidate of candidates) {
    const dept = jobById[candidate.jobOpeningId]?.departmentName ?? 'Unassigned';
    counts.set(dept, (counts.get(dept) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function computeSourceChart(candidates: Candidate[]): SourceChartPoint[] {
  const counts = new Map<CandidateSource, number>();

  for (const candidate of candidates) {
    const source = candidate.source ?? 'OTHER';
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([source, value]) => ({
      source,
      name: SOURCE_LABELS[source],
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

export function countApplicantsByJob(candidates: Candidate[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const candidate of candidates) {
    counts[candidate.jobOpeningId] = (counts[candidate.jobOpeningId] ?? 0) + 1;
  }
  return counts;
}

export function toApplicantRows(candidates: Candidate[], jobs: JobOpening[]): ApplicantRow[] {
  const jobById = Object.fromEntries(jobs.map((job) => [job.id, job]));

  return candidates
    .map((candidate) => {
      const job = jobById[candidate.jobOpeningId];
      return {
        id: candidate.id,
        jobOpeningId: candidate.jobOpeningId,
        name: `${candidate.firstName} ${candidate.lastName}`.trim(),
        email: candidate.email,
        role: job?.title ?? 'Unknown role',
        date: candidate.appliedAt ?? candidate.createdAt ?? '',
        employmentType: job?.employmentType ?? '—',
        status: candidate.status,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function filterApplicantsByTab(rows: ApplicantRow[], tab: string): ApplicantRow[] {
  switch (tab) {
    case 'screening':
      return rows.filter((r) => ['APPLIED', 'SCREENING', 'UNDER_REVIEW'].includes(r.status));
    case 'shortlisted':
      return rows.filter((r) => r.status === 'INTERVIEW');
    case 'interviewing':
      return rows.filter((r) => r.status === 'INTERVIEW');
    case 'offer':
      return rows.filter((r) => ['OFFER', 'HIRED'].includes(r.status));
    default:
      return rows.filter((r) => r.status !== 'WITHDRAWN');
  }
}

export function formatStatusLabel(status: CandidateStatus) {
  if (status === 'UNDER_REVIEW') return 'Under review';
  if (status === 'OFFER') return 'Job offer';
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function formatEmploymentType(value?: string) {
  if (!value) return '—';
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join('-');
}
