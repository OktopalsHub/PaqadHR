import type { SelectQueryBuilder } from 'typeorm';
import type { JobFilterOptions } from '../../../../common/interfaces/job-filter-options.interface';
import { JobOpening } from '../entities/job-opening.entity';

export function applyJobOpeningFilters(
  queryBuilder: SelectQueryBuilder<JobOpening>,
  filters?: JobFilterOptions,
): void {
  if (!filters) return;
  if (filters.tenantId) {
    queryBuilder.andWhere('job.tenantId = :tenantId', { tenantId: filters.tenantId });
  }
  if (filters.status) {
    queryBuilder.andWhere('job.status = :status', { status: filters.status });
  }
  if (filters.departmentId) {
    queryBuilder.andWhere('job.departmentId = :departmentId', {
      departmentId: filters.departmentId,
    });
  }
  if (filters.employmentType) {
    queryBuilder.andWhere('job.employmentType = :employmentType', {
      employmentType: filters.employmentType,
    });
  }
  if (filters.experienceLevel) {
    queryBuilder.andWhere('job.experienceLevel = :experienceLevel', {
      experienceLevel: filters.experienceLevel,
    });
  }
  if (filters.location) {
    queryBuilder.andWhere(
      "(job.location ->> 'city' ILIKE :location OR job.location ->> 'country' ILIKE :location OR job.location ->> 'address' ILIKE :location)",
      { location: `%${filters.location}%` },
    );
  }
  if (filters.search) {
    queryBuilder.andWhere(
      '(job.title ILIKE :search OR job.description ILIKE :search OR job.position ILIKE :search)',
      { search: `%${filters.search}%` },
    );
  }
  if (filters.isUrgent !== undefined) {
    queryBuilder.andWhere('job.isUrgent = :isUrgent', {
      isUrgent: filters.isUrgent,
    });
  }
}
