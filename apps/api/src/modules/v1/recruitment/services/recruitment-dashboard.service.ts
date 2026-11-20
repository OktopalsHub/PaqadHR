import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CandidateStatus, JobStatus } from 'src/common/enums';
import { Repository } from 'typeorm';

import { Candidate } from '../entities/candidate.entity';
import { JobOpening } from '../entities/job-opening.entity';

const MAX_VACANCIES = 12;
const MAX_RECENT_APPLICANTS = 50;
const INACTIVE_STATUSES = [
  CandidateStatus.HIRED,
  CandidateStatus.REJECTED,
  CandidateStatus.WITHDRAWN,
];

@Injectable()
export class RecruitmentDashboardService {
  constructor(
    @InjectRepository(JobOpening)
    private readonly jobRepository: Repository<JobOpening>,
    @InjectRepository(Candidate)
    private readonly candidateRepository: Repository<Candidate>,
  ) {}

  async getSummary(tenantId: string) {
    const [openRoles, vacancies, statusRows, applicantCountRows, recentApplicants] =
      await Promise.all([
        this.jobRepository.count({ where: { tenantId, status: JobStatus.ACTIVE } }),
        this.jobRepository
          .createQueryBuilder('job')
          .select(['job.id', 'job.title', 'job.employmentType', 'job.status', 'job.location'])
          .where('job.tenantId = :tenantId', { tenantId })
          .andWhere('job.status = :status', { status: JobStatus.ACTIVE })
          .orderBy('job.isUrgent', 'DESC')
          .addOrderBy('job.publishedAt', 'DESC')
          .limit(MAX_VACANCIES)
          .getMany(),
        this.candidateRepository
          .createQueryBuilder('candidate')
          .select('candidate.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .where('candidate.tenantId = :tenantId', { tenantId })
          .groupBy('candidate.status')
          .getRawMany<{ status: CandidateStatus; count: string }>(),
        this.candidateRepository
          .createQueryBuilder('candidate')
          .select('candidate.jobOpeningId', 'jobOpeningId')
          .addSelect('COUNT(*)', 'count')
          .where('candidate.tenantId = :tenantId', { tenantId })
          .groupBy('candidate.jobOpeningId')
          .getRawMany<{ jobOpeningId: string; count: string }>(),
        this.candidateRepository
          .createQueryBuilder('candidate')
          .leftJoin('candidate.jobOpening', 'job')
          .select([
            'candidate.id',
            'candidate.jobOpeningId',
            'candidate.firstName',
            'candidate.lastName',
            'candidate.email',
            'candidate.status',
            'candidate.appliedAt',
            'candidate.createdAt',
            'job.title',
            'job.employmentType',
          ])
          .where('candidate.tenantId = :tenantId', { tenantId })
          .orderBy('candidate.appliedAt', 'DESC', 'NULLS LAST')
          .limit(MAX_RECENT_APPLICANTS)
          .getMany(),
      ]);

    const statusCounts: Record<string, number> = {};
    let totalCandidates = 0;
    let activeCandidates = 0;
    for (const row of statusRows) {
      const count = Number(row.count);
      statusCounts[row.status] = count;
      totalCandidates += count;
      if (!INACTIVE_STATUSES.includes(row.status)) activeCandidates += count;
    }

    const applicantCounts = new Map(
      applicantCountRows.map((row) => [row.jobOpeningId, Number(row.count)]),
    );

    return {
      openRoles,
      totalCandidates,
      activeCandidates,
      statusCounts,
      vacancies: vacancies.map((job) => ({
        id: job.id,
        title: job.title,
        employmentType: job.employmentType,
        status: job.status,
        location: job.location,
        applicantCount: applicantCounts.get(job.id) ?? 0,
      })),
      recentApplicants: recentApplicants.map((candidate) => ({
        id: candidate.id,
        jobOpeningId: candidate.jobOpeningId,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        status: candidate.status,
        appliedAt: candidate.appliedAt ?? candidate.createdAt ?? null,
        roleTitle: candidate.jobOpening?.title ?? null,
        employmentType: candidate.jobOpening?.employmentType ?? null,
      })),
    };
  }
}
