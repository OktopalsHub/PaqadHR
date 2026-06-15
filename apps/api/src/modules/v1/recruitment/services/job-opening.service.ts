import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JobStatus } from 'src/common/enums';
import type { Repository } from 'typeorm';
import type { JobFilterOptions } from '../../../../common/interfaces/job-filter-options.interface';
import { Department } from '../../departments/entities/department.entity';
import type { CreateJobOpeningDto } from '../dto/index';
import type { UpdateJobOpeningDto } from '../dto/update-job-opening.dto';
import type { JobOpening } from '../entities/job-opening.entity';
import type { JobOpeningRepository } from '../repositories/job-opening.repository';

@Injectable()
export class JobOpeningService {
  constructor(
    private readonly jobOpeningRepository: JobOpeningRepository,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}
  async createJob(
    tenantId: string,
    memberId: string,
    createJobOpeningDto: CreateJobOpeningDto,
  ): Promise<JobOpening> {
    const jobData = {
      title: createJobOpeningDto.title,
      departmentId: createJobOpeningDto.departmentId ?? null,
      position: createJobOpeningDto.position,
      employmentType: createJobOpeningDto.employmentType,
      experienceLevel: createJobOpeningDto.experienceLevel,
      location: createJobOpeningDto.location,
      description: createJobOpeningDto.description,
      requirements: createJobOpeningDto.requirements,
      responsibilities: createJobOpeningDto.responsibilities,
      preferredQualifications: createJobOpeningDto.preferredQualifications,
      requiredSkills: createJobOpeningDto.requiredSkills,
      minimumSalary: createJobOpeningDto.minimumSalary,
      maximumSalary: createJobOpeningDto.maximumSalary,
      currency: createJobOpeningDto.currency,
      benefits: createJobOpeningDto.benefits,
      numberOfOpenings: createJobOpeningDto.numberOfOpenings,
      applicationDeadline: createJobOpeningDto.applicationDeadline,
      isUrgent: createJobOpeningDto.isUrgent || false,
      customQuestions: createJobOpeningDto.customQuestions,
      tenantId,
      tenantMemberId: memberId,
      hiringManagerId: memberId,
      status: JobStatus.DRAFT,
    };
    return this.jobOpeningRepository.create(jobData);
  }
  async getJobsByTenant(
    tenantId: string,
    memberId: string,
    filters?: JobFilterOptions,
  ): Promise<{ jobs: JobOpening[]; total: number }> {
    const result = await this.jobOpeningRepository.findAllByTenantMember(
      tenantId,
      memberId,
      filters,
    );
    return result;
  }
  async getJob(jobId: string, tenantId: string, memberId: string): Promise<JobOpening> {
    const job = await this.jobOpeningRepository.findByTenantMemberAndId(tenantId, memberId, jobId);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return job;
  }
  async updateJob(
    jobId: string,
    tenantId: string,
    memberId: string,
    updateJobOpeningDto: UpdateJobOpeningDto,
  ): Promise<JobOpening> {
    await this.getJob(jobId, tenantId, memberId);
    await this.jobOpeningRepository.update(jobId, updateJobOpeningDto);
    const updatedJob = await this.jobOpeningRepository.findOne({
      where: { id: jobId },
    });
    if (!updatedJob) {
      throw new NotFoundException('Job not found');
    }
    return updatedJob;
  }
  async deleteJob(jobId: string, tenantId: string, memberId: string): Promise<void> {
    const job = await this.getJob(jobId, tenantId, memberId);
    if (job.interviews && job.interviews.length > 0) {
      throw new ForbiddenException('Cannot delete job with existing applications');
    }
    await this.jobOpeningRepository.softDelete(jobId);
  }
  async activateJob(jobId: string, tenantId: string, memberId: string): Promise<JobOpening> {
    const job = await this.getJob(jobId, tenantId, memberId);
    if (job.status === JobStatus.ACTIVE) {
      throw new ConflictException('Job is already active');
    }
    if (job.status !== JobStatus.DRAFT && job.status !== JobStatus.INACTIVE) {
      throw new ForbiddenException('Only draft or inactive jobs can be activated');
    }
    await this.jobOpeningRepository.update(jobId, {
      status: JobStatus.ACTIVE,
      publishedAt: new Date(),
    });
    const updatedJob = await this.jobOpeningRepository.findOne({
      where: { id: jobId },
    });
    if (!updatedJob) {
      throw new NotFoundException('Job not found');
    }
    return updatedJob;
  }
  async deactivateJob(jobId: string, tenantId: string, memberId: string): Promise<JobOpening> {
    const job = await this.getJob(jobId, tenantId, memberId);
    if (job.status !== JobStatus.ACTIVE) {
      throw new ConflictException('Only active jobs can be deactivated');
    }
    await this.jobOpeningRepository.update(jobId, {
      status: JobStatus.INACTIVE,
    });
    const updatedJob = await this.jobOpeningRepository.findOne({
      where: { id: jobId },
    });
    if (!updatedJob) {
      throw new NotFoundException('Job not found');
    }
    return updatedJob;
  }
  async closeJob(jobId: string, tenantId: string, memberId: string): Promise<JobOpening> {
    const job = await this.getJob(jobId, tenantId, memberId);
    if (job.status === JobStatus.CLOSED) {
      throw new ConflictException('Job is already closed');
    }
    if (job.status === JobStatus.ARCHIVED) {
      throw new ConflictException('Archived jobs cannot be closed');
    }
    await this.jobOpeningRepository.update(jobId, {
      status: JobStatus.CLOSED,
      closedAt: new Date(),
    });
    const updatedJob = await this.jobOpeningRepository.findOne({
      where: { id: jobId },
    });
    if (!updatedJob) {
      throw new NotFoundException('Job not found');
    }
    return updatedJob;
  }
  async archiveJob(jobId: string, tenantId: string, memberId: string): Promise<JobOpening> {
    const job = await this.getJob(jobId, tenantId, memberId);
    if (job.status !== JobStatus.CLOSED) {
      throw new ConflictException('Only closed jobs can be archived');
    }
    await this.jobOpeningRepository.update(jobId, {
      status: JobStatus.ARCHIVED,
    });
    const updatedJob = await this.jobOpeningRepository.findOne({
      where: { id: jobId },
    });
    if (!updatedJob) {
      throw new NotFoundException('Job not found');
    }
    return updatedJob;
  }
  async getActiveJobs(filters?: JobFilterOptions): Promise<{ jobs: JobOpening[]; total: number }> {
    const activeFilters = {
      ...filters,
      status: JobStatus.ACTIVE,
    };
    return this.jobOpeningRepository.findPublicJobs(activeFilters);
  }
  async getActiveJob(jobId: string): Promise<JobOpening> {
    const job = await this.jobOpeningRepository.findActiveJobById(jobId);
    if (!job) {
      throw new NotFoundException('Job not found or not available');
    }
    return job;
  }
  async getDepartmentsByTenant(tenantId: string): Promise<{ id: string; name: string }[]> {
    const departments = await this.departmentRepository.find({
      where: { tenantId },
      select: ['id', 'name'],
      order: { name: 'ASC' },
    });
    return departments.map((dept) => ({ id: dept.id, name: dept.name }));
  }
  async getActiveDepartments(): Promise<{ id: string; name: string }[]> {
    return this.jobOpeningRepository.getActiveDepartments();
  }
  async getActiveLocations(): Promise<string[]> {
    return this.jobOpeningRepository.getActiveLocations();
  }
  async getPublicJobStats(): Promise<{
    totalActiveJobs: number;
    totalDepartments: number;
    totalLocations: number;
    urgentJobs: number;
    recentJobs: number;
  }> {
    return this.jobOpeningRepository.getPublicJobStats();
  }
  async getRecentJobs(limit: number = 5): Promise<JobOpening[]> {
    return this.jobOpeningRepository.getRecentJobs(limit);
  }
  async getUrgentJobs(limit: number = 10): Promise<JobOpening[]> {
    return this.jobOpeningRepository.getUrgentJobs(limit);
  }
  async getSearchSuggestions(query: string): Promise<{ titles: string[]; positions: string[] }> {
    return this.jobOpeningRepository.getSearchSuggestions(query);
  }
  async getJobStats(tenantId: string): Promise<{
    total: number;
    draft: number;
    active: number;
    inactive: number;
    closed: number;
    archived: number;
  }> {
    return this.jobOpeningRepository.getJobStatsByTenant(tenantId);
  }
}
