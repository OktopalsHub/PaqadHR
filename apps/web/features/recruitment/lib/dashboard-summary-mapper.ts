import type { DashboardRecruitmentSummary } from '@/lib/api/recruitment';

import type { ApplicantRow } from './recruitment-dashboard-metrics';

export type DashboardVacancy = DashboardRecruitmentSummary['vacancies'][number];

export function toDashboardApplicantRows(
  applicants: DashboardRecruitmentSummary['recentApplicants'],
): ApplicantRow[] {
  return applicants.map((applicant) => ({
    id: applicant.id,
    jobOpeningId: applicant.jobOpeningId,
    name: `${applicant.firstName} ${applicant.lastName}`.trim(),
    email: applicant.email,
    role: applicant.roleTitle ?? 'Unknown role',
    date: applicant.appliedAt ?? '',
    employmentType: applicant.employmentType ?? '—',
    status: applicant.status,
  }));
}

export function toVacancyApplicantCounts(vacancies: DashboardVacancy[]): Record<string, number> {
  return Object.fromEntries(vacancies.map((vacancy) => [vacancy.id, vacancy.applicantCount]));
}

const PIPELINE_STAGES = [
  { label: 'Applied', statuses: ['APPLIED'] },
  { label: 'Screening', statuses: ['SCREENING', 'UNDER_REVIEW'] },
  { label: 'Interview', statuses: ['INTERVIEW'] },
  { label: 'Offer', statuses: ['OFFER'] },
  { label: 'Hired', statuses: ['HIRED'] },
];

export function toPipelineStages(statusCounts: Record<string, number>) {
  return PIPELINE_STAGES.map((stage) => ({
    label: stage.label,
    count: stage.statuses.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0),
  }));
}
