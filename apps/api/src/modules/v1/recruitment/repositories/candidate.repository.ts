import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CandidateStatus } from 'src/common/enums';
import type { IPaginatedData } from 'src/common/interfaces/pagination.interface';
import { In, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { Candidate } from '../entities/candidate.entity';

@Injectable()
export class CandidateRepository extends Repository<Candidate> {
  constructor(
    @InjectRepository(Candidate)
    private readonly candidateRepository: Repository<Candidate>,
  ) {
    super(candidateRepository.target, candidateRepository.manager, candidateRepository.queryRunner);
  }
  async findByTenantOnly(tenantId: string, includeDeleted = false): Promise<Candidate[]> {
    return this.find({
      withDeleted: includeDeleted,
      where: { tenantId },
      relations: ['jobOpening'],
    });
  }
  async findByTenantAndId(
    tenantId: string,
    candidateId: string,
    includeDeleted = false,
  ): Promise<Candidate | null> {
    return this.findOne({
      where: { id: candidateId, tenantId },
      withDeleted: includeDeleted,
      relations: ['jobOpening'],
    });
  }
  async findByJobOpening(
    jobOpeningId: string,
    tenantId: string,
    includeDeleted = false,
  ): Promise<Candidate[]> {
    return this.find({
      withDeleted: includeDeleted,
      where: { jobOpeningId, tenantId },
      relations: ['jobOpening'],
    });
  }
  async findByEmailAndJob(email: string, jobOpeningId: string): Promise<Candidate | null> {
    const normalizedEmail = email.trim().toLowerCase();
    return this.createQueryBuilder('candidate')
      .where('candidate.jobOpeningId = :jobOpeningId', { jobOpeningId })
      .andWhere('LOWER(candidate.email) = :email', { email: normalizedEmail })
      .getOne();
  }
  async findByApplicationIdAndEmail(
    applicationId: string,
    email: string,
  ): Promise<Candidate | null> {
    const normalizedEmail = email.trim().toLowerCase();
    return this.createQueryBuilder('candidate')
      .where('candidate.id = :applicationId', { applicationId })
      .andWhere('LOWER(candidate.email) = :email', { email: normalizedEmail })
      .leftJoinAndSelect('candidate.jobOpening', 'jobOpening')
      .getOne();
  }
  async findByApplicationIdEmailAndJob(
    applicationId: string,
    email: string,
    jobOpeningId: string,
  ): Promise<Candidate | null> {
    const normalizedEmail = email.trim().toLowerCase();
    return this.createQueryBuilder('candidate')
      .where('candidate.id = :applicationId', { applicationId })
      .andWhere('candidate.jobOpeningId = :jobOpeningId', { jobOpeningId })
      .andWhere('LOWER(candidate.email) = :email', { email: normalizedEmail })
      .leftJoinAndSelect('candidate.jobOpening', 'jobOpening')
      .getOne();
  }
  async findAllByTenant(
    tenantId: string,
    page?: number,
    limit?: number,
  ): Promise<Candidate[] | IPaginatedData<Candidate>> {
    if (page && limit) {
      return this.listPaginated(page, limit, false, { tenantId }, ['jobOpening'], 'candidates');
    }
    return this.find({
      withDeleted: false,
      where: { tenantId },
      relations: ['jobOpening'],
    });
  }
  async listPaginated(
    page: number,
    limit: number,
    includeDeleted = false,
    where?: { tenantId: string },
    relations?: string[],
    name = 'candidates',
  ): Promise<IPaginatedData<Candidate>> {
    const [records, totalItems] = await this.findAndCount({
      withDeleted: includeDeleted,
      where,
      relations,
      skip: (page - 1) * limit,
      take: limit,
    });
    const pageCount = Math.ceil(totalItems / limit);
    return {
      name,
      size: records.length,
      pageCount,
      limit,
      page,
      previousPage: page > 1 ? page - 1 : null,
      nextPage: page < pageCount ? page + 1 : null,
      totalItems,
      records,
    };
  }
  async countByStatus(tenantId: string, status: CandidateStatus): Promise<number> {
    return this.count({ where: { tenantId, status } });
  }
  async findRecentApplications(tenantId: string, days: number = 30): Promise<Candidate[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return this.find({
      where: {
        tenantId,
        appliedAt: MoreThanOrEqual(since),
      },
      relations: ['jobOpening'],
      order: { appliedAt: 'DESC' },
    });
  }
  async findApplicationsByEmail(email: string): Promise<Candidate[]> {
    return this.find({
      where: { email },
      relations: ['jobOpening'],
      order: { appliedAt: 'DESC' },
    });
  }
  async hasActiveApplications(email: string): Promise<boolean> {
    const count = await this.candidateRepository.count({
      where: {
        email,
        status: Not(
          In([CandidateStatus.WITHDRAWN, CandidateStatus.HIRED, CandidateStatus.REJECTED]),
        ),
      },
    });
    return count > 0;
  }
  async findApplicationsByEmailAndTenant(email: string, tenantId: string): Promise<Candidate[]> {
    return this.find({
      where: { email, tenantId },
      relations: ['jobOpening'],
      order: { appliedAt: 'DESC' },
    });
  }
}
