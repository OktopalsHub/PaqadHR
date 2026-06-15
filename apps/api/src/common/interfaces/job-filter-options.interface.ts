import type { JobStatus } from 'src/common/enums';

export interface JobFilterOptions {
  status?: JobStatus;
  departmentId?: string;
  employmentType?: string;
  experienceLevel?: string;
  location?: string;
  search?: string;
  isUrgent?: boolean;
  page?: number;
  limit?: number;
}
