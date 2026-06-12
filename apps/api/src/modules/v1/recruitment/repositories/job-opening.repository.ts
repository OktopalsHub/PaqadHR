import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JobStatus } from 'src/common/enums';
import { FindOptionsWhere, Repository, SelectQueryBuilder } from 'typeorm';
import { JobOpening } from "../entities/job-opening.entity";
import { JobFilterOptions } from "../../../../common/interfaces/job-filter-options.interface";

@Injectable()
export class JobOpeningRepository extends Repository<JobOpening> {
  constructor(
    @InjectRepository(JobOpening)
    private readonly jobOpeningRepository: Repository<JobOpening>,
  ) {
    super(jobOpeningRepository.target, jobOpeningRepository.manager, jobOpeningRepository.queryRunner);
  }
  async findAllByTenantMember(
    tenantId: string,
    memberId: string,
    filters?: JobFilterOptions,
  ): Promise<{ jobs: JobOpening[]; total: number }> {
    const queryBuilder = this.jobOpeningRepository
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.department', 'department')
      .where('job.tenantId = :tenantId', { tenantId })
      .andWhere('job.tenantMemberId = :memberId', { memberId })
      .andWhere('job.deletedAt IS NULL');
    this.applyFilters(queryBuilder, filters);
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;
    const [jobs, total] = await queryBuilder
      .orderBy('job.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    return { jobs, total };
  }
  async findByTenantMemberAndId(
    tenantId: string,
    memberId: string,
    jobOpeningId: string,
    includeDeleted = false,
  ): Promise<JobOpening | null> {
    return this.findById(
      jobOpeningId,
      includeDeleted,
      { tenantId, tenantMemberId: memberId },
      [],
    );
  }
  async findPublicJobs(
    filters?: JobFilterOptions,
  ): Promise<{ jobs: JobOpening[]; total: number }> {
    const queryBuilder = this.jobOpeningRepository
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.department', 'department')
      .where('job.status = :status', { status: JobStatus.ACTIVE })
      .andWhere('job.deletedAt IS NULL');
    this.applyFilters(queryBuilder, filters);
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;
    const [jobs, total] = await queryBuilder
      .orderBy('job.isUrgent', 'DESC')
      .addOrderBy('job.publishedAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    return { jobs, total };
  }
  async findById(
    id: string,
    includeDeleted = false,
    additionalWhere?: FindOptionsWhere<JobOpening>,
    relations?: string[],
  ): Promise<JobOpening | null> {
    return this.findOne({
      where: { id, ...additionalWhere },
      withDeleted: includeDeleted,
      relations,
    });
  }

  async findActiveJobById(jobId: string): Promise<JobOpening | null> {
    return this.findOne({
      where: {
        id: jobId,
        status: JobStatus.ACTIVE,
      },
    });
  }
  async findByTenant(
    tenantId: string,
    includeDeleted = false,
  ): Promise<JobOpening[]> {
    return this.find({ withDeleted: includeDeleted, where: { tenantId } });
  }
  async countByStatus(tenantId: string, status: JobStatus): Promise<number> {
    return this.count({ where: { tenantId, status } });
  }
  async findJobsWithApplications(tenantId: string): Promise<JobOpening[]> {
    return this.find({
      where: { tenantId },
      relations: ['interviews'],
    });
  }
  async getJobStatsByTenant(tenantId: string): Promise<{
    total: number;
    draft: number;
    active: number;
    inactive: number;
    closed: number;
    archived: number;
  }> {
    const stats = await this.jobOpeningRepository
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('job.tenantId = :tenantId', { tenantId })
      .andWhere('job.deletedAt IS NULL')
      .groupBy('job.status')
      .getRawMany();
    const result = {
      total: 0,
      draft: 0,
      active: 0,
      inactive: 0,
      closed: 0,
      archived: 0,
    };
    stats.forEach((stat) => {
      const count = parseInt(stat.count);
      result.total += count;
      switch (stat.status) {
        case JobStatus.DRAFT:
          result.draft = count;
          break;
        case JobStatus.ACTIVE:
          result.active = count;
          break;
        case JobStatus.INACTIVE:
          result.inactive = count;
          break;
        case JobStatus.CLOSED:
          result.closed = count;
          break;
        case JobStatus.ARCHIVED:
          result.archived = count;
          break;
      }
    });
    return result;
  }
  async getActiveDepartments(): Promise<{ id: string; name: string }[]> {
    const result = await this.jobOpeningRepository
      .createQueryBuilder('job')
      .innerJoin('job.department', 'department')
      .select('DISTINCT department.id', 'id')
      .addSelect('department.name', 'name')
      .where('job.status = :status', { status: JobStatus.ACTIVE })
      .andWhere('job.deletedAt IS NULL')
      .andWhere('job.departmentId IS NOT NULL')
      .orderBy('department.name', 'ASC')
      .getRawMany();
    return result
      .map((item) => ({ id: item.id, name: item.name }))
      .filter(Boolean);
  }
  async getActiveLocations(): Promise<string[]> {
    const result = await this.jobOpeningRepository
      .createQueryBuilder('job')
      .select(
        "DISTINCT CONCAT(job.location ->> 'city', ', ', job.location ->> 'country')",
        'location',
      )
      .where('job.status = :status', { status: JobStatus.ACTIVE })
      .andWhere('job.deletedAt IS NULL')
      .andWhere('job.location IS NOT NULL')
      .andWhere("job.location ->> 'city' IS NOT NULL")
      .andWhere("job.location ->> 'country' IS NOT NULL")
      .orderBy('location', 'ASC')
      .getRawMany();
    return result.map((item) => item.location).filter(Boolean);
  }
  async getPublicJobStats(): Promise<{
    totalActiveJobs: number;
    totalDepartments: number;
    totalLocations: number;
    urgentJobs: number;
    recentJobs: number;
  }> {
    const baseQuery = this.jobOpeningRepository
      .createQueryBuilder('job')
      .where('job.status = :status', { status: JobStatus.ACTIVE })
      .andWhere('job.deletedAt IS NULL');
    const totalActiveJobs = await baseQuery.getCount();
    const urgentJobs = await this.jobOpeningRepository
      .createQueryBuilder('job')
      .where('job.status = :status', { status: JobStatus.ACTIVE })
      .andWhere('job.deletedAt IS NULL')
      .andWhere('job.isUrgent = :isUrgent', { isUrgent: true })
      .getCount();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentJobs = await this.jobOpeningRepository
      .createQueryBuilder('job')
      .where('job.status = :status', { status: JobStatus.ACTIVE })
      .andWhere('job.deletedAt IS NULL')
      .andWhere('job.publishedAt >= :sevenDaysAgo', { sevenDaysAgo })
      .getCount();
    const departmentsResult = await this.jobOpeningRepository
      .createQueryBuilder('job')
      .select('COUNT(DISTINCT job.departmentId)', 'count')
      .where('job.status = :status', { status: JobStatus.ACTIVE })
      .andWhere('job.deletedAt IS NULL')
      .andWhere('job.departmentId IS NOT NULL')
      .getRawOne();
    const locationsResult = await this.jobOpeningRepository
      .createQueryBuilder('job')
      .select(
        "COUNT(DISTINCT CONCAT(job.location ->> 'city', ', ', job.location ->> 'country'))",
        'count',
      )
      .where('job.status = :status', { status: JobStatus.ACTIVE })
      .andWhere('job.deletedAt IS NULL')
      .andWhere('job.location IS NOT NULL')
      .andWhere("job.location ->> 'city' IS NOT NULL")
      .andWhere("job.location ->> 'country' IS NOT NULL")
      .getRawOne();
    return {
      totalActiveJobs,
      totalDepartments: parseInt(departmentsResult?.count || '0'),
      totalLocations: parseInt(locationsResult?.count || '0'),
      urgentJobs,
      recentJobs,
    };
  }
  async getRecentJobs(limit: number = 5): Promise<JobOpening[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return this.jobOpeningRepository
      .createQueryBuilder('job')
      .where('job.status = :status', { status: JobStatus.ACTIVE })
      .andWhere('job.deletedAt IS NULL')
      .andWhere('job.publishedAt >= :sevenDaysAgo', { sevenDaysAgo })
      .orderBy('job.publishedAt', 'DESC')
      .limit(limit)
      .getMany();
  }
  async getUrgentJobs(limit: number = 10): Promise<JobOpening[]> {
    return this.jobOpeningRepository
      .createQueryBuilder('job')
      .where('job.status = :status', { status: JobStatus.ACTIVE })
      .andWhere('job.deletedAt IS NULL')
      .andWhere('job.isUrgent = :isUrgent', { isUrgent: true })
      .orderBy('job.publishedAt', 'DESC')
      .limit(limit)
      .getMany();
  }
  async getSearchSuggestions(
    query: string,
  ): Promise<{ titles: string[]; positions: string[] }> {
    const searchTerm = `%${query.toLowerCase()}%`;
    const titleResults = await this.jobOpeningRepository
      .createQueryBuilder('job')
      .select('DISTINCT job.title', 'title')
      .where('job.status = :status', { status: JobStatus.ACTIVE })
      .andWhere('job.deletedAt IS NULL')
      .andWhere('LOWER(job.title) LIKE :searchTerm', { searchTerm })
      .orderBy('job.title', 'ASC')
      .limit(10)
      .getRawMany();
    const positionResults = await this.jobOpeningRepository
      .createQueryBuilder('job')
      .select('DISTINCT job.position', 'position')
      .where('job.status = :status', { status: JobStatus.ACTIVE })
      .andWhere('job.deletedAt IS NULL')
      .andWhere('LOWER(job.position) LIKE :searchTerm', { searchTerm })
      .andWhere('job.position IS NOT NULL')
      .orderBy('job.position', 'ASC')
      .limit(10)
      .getRawMany();
    return {
      titles: titleResults.map((item) => item.title).filter(Boolean),
      positions: positionResults.map((item) => item.position).filter(Boolean),
    };
  }
  private applyFilters(
    queryBuilder: SelectQueryBuilder<JobOpening>,
    filters?: JobFilterOptions,
  ): void {
    if (!filters) return;
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
}
