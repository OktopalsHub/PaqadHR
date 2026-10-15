export type SearchableRecruitmentJob = {
  title: string;
  departmentName?: string;
  position?: string;
  employmentType?: string;
  location?: {
    type?: string;
  };
};

function searchableJobFields(job: SearchableRecruitmentJob): string[] {
  return [
    job.title,
    job.departmentName,
    job.position,
    job.employmentType,
    job.location?.type,
  ].filter((value): value is string => Boolean(value));
}

export function filterRecruitmentJobs<T extends SearchableRecruitmentJob>(
  jobs: T[],
  search: string,
): T[] {
  const term = search.trim().toLowerCase();
  if (!term) return jobs;

  return jobs.filter((job) => searchableJobFields(job).join(' ').toLowerCase().includes(term));
}
