import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InterviewStatus } from 'src/common/enums';
import { InterviewFilters } from 'src/common/interfaces';
import { Between, Repository } from 'typeorm';
import { Interview } from "../entities/interview.entity";

@Injectable()
export class InterviewRepository extends Repository<Interview> {
  constructor(
    @InjectRepository(Interview)
    private readonly interviewRepository: Repository<Interview>,
  ) {
    super(interviewRepository.target, interviewRepository.manager, interviewRepository.queryRunner);
  }
  async findByTenantMemberAndId(
    tenantId: string,
    tenantMemberId: string,
    interviewId: string,
    includeDeleted: boolean = false,
    relations: string[] = ['candidate', 'jobOpening'],
  ): Promise<Interview> {
    const interview = await this.interviewRepository.findOne({
      where: {
        id: interviewId,
        tenantMemberId,
        tenantId,
      },
      withDeleted: includeDeleted,
      relations,
    });
    if (!interview) {
      throw new NotFoundException('Interview not found for this member');
    }
    return interview;
  }
  async findAllByTenantMember(
    tenantId: string,
    tenantMemberId: string,
    filters?: InterviewFilters,
    includeDeleted: boolean = false,
    relations: string[] = ['candidate', 'jobOpening'],
  ): Promise<Interview[]> {
    const queryBuilder = this.interviewRepository
      .createQueryBuilder('interview')
      .leftJoinAndSelect('interview.candidate', 'candidate')
      .leftJoinAndSelect('interview.jobOpening', 'jobOpening')
      .where('interview.tenantMemberId = :tenantMemberId', { tenantMemberId })
      .andWhere('interview.tenantId = :tenantId', { tenantId });
    if (!includeDeleted) {
      queryBuilder.andWhere('interview.deletedAt IS NULL');
    }
    if (filters?.status) {
      queryBuilder.andWhere('interview.status = :status', {
        status: filters.status,
      });
    }
    if (filters?.type) {
      queryBuilder.andWhere('interview.type = :type', { type: filters.type });
    }
    if (filters?.candidateId) {
      queryBuilder.andWhere('interview.candidateId = :candidateId', {
        candidateId: filters.candidateId,
      });
    }
    if (filters?.jobOpeningId) {
      queryBuilder.andWhere('interview.jobOpeningId = :jobOpeningId', {
        jobOpeningId: filters.jobOpeningId,
      });
    }
    if (filters?.interviewerId) {
      queryBuilder.andWhere(
        "JSON_EXTRACT(interview.interviewers, '$[*].userId') LIKE :interviewerId",
        { interviewerId: `%${filters.interviewerId}%` },
      );
    }
    if (filters?.dateFrom && filters?.dateTo) {
      queryBuilder.andWhere('interview.date BETWEEN :dateFrom AND :dateTo', {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
    } else if (filters?.dateFrom) {
      queryBuilder.andWhere('interview.date >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    } else if (filters?.dateTo) {
      queryBuilder.andWhere('interview.date <= :dateTo', {
        dateTo: filters.dateTo,
      });
    }
    return queryBuilder.orderBy('interview.date', 'ASC').getMany();
  }
  async findByCandidate(
    candidateId: string,
    tenantId: string,
    tenantMemberId: string,
    includeDeleted: boolean = false,
    relations: string[] = ['jobOpening'],
  ): Promise<Interview[]> {
    return this.interviewRepository.find({
      where: {
        candidateId,
        tenantMemberId,
        tenantId,
      },
      withDeleted: includeDeleted,
      relations,
      order: { date: 'ASC' },
    });
  }
  async findByJobOpening(
    jobOpeningId: string,
    tenantId: string,
    tenantMemberId: string,
    includeDeleted: boolean = false,
    relations: string[] = ['candidate'],
  ): Promise<Interview[]> {
    return this.interviewRepository.find({
      where: {
        jobOpeningId,
        tenantMemberId,
        tenantId,
      },
      withDeleted: includeDeleted,
      relations,
      order: { date: 'ASC' },
    });
  }
  async findUpcomingInterviews(
    tenantId: string,
    tenantMemberId: string,
    days: number = 7,
  ): Promise<Interview[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);
    return this.interviewRepository.find({
      where: {
        tenantId,
        tenantMemberId,
        status: InterviewStatus.SCHEDULED,
        date: Between(now, futureDate),
      },
      relations: ['candidate', 'jobOpening'],
      order: { date: 'ASC' },
    });
  }
  async findTodaysInterviews(
    tenantId: string,
    tenantMemberId: string,
  ): Promise<Interview[]> {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    return this.interviewRepository.find({
      where: {
        tenantId,
        tenantMemberId,
        date: Between(startOfDay, endOfDay),
      },
      relations: ['candidate', 'jobOpening'],
      order: { date: 'ASC' },
    });
  }
  async findByInterviewer(
    interviewerId: string,
    tenantId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<Interview[]> {
    const queryBuilder = this.interviewRepository
      .createQueryBuilder('interview')
      .leftJoinAndSelect('interview.candidate', 'candidate')
      .leftJoinAndSelect('interview.jobOpening', 'jobOpening')
      .where('interview.tenantId = :tenantId', { tenantId })
      .andWhere(
        "JSON_EXTRACT(interview.interviewers, '$[*].userId') LIKE :interviewerId",
        { interviewerId: `%${interviewerId}%` },
      )
      .andWhere('interview.deletedAt IS NULL');
    if (dateFrom && dateTo) {
      queryBuilder.andWhere('interview.date BETWEEN :dateFrom AND :dateTo', {
        dateFrom,
        dateTo,
      });
    } else if (dateFrom) {
      queryBuilder.andWhere('interview.date >= :dateFrom', { dateFrom });
    } else if (dateTo) {
      queryBuilder.andWhere('interview.date <= :dateTo', { dateTo });
    }
    return queryBuilder.orderBy('interview.date', 'ASC').getMany();
  }
  async countByStatus(
    tenantId: string,
    tenantMemberId: string,
    status: InterviewStatus,
  ): Promise<number> {
    return this.interviewRepository.count({
      where: {
        tenantId,
        tenantMemberId,
        status,
      },
    });
  }
  async findInterviewsRequiringFeedback(
    tenantId: string,
    tenantMemberId: string,
  ): Promise<Interview[]> {
    const queryBuilder = this.interviewRepository
      .createQueryBuilder('interview')
      .leftJoinAndSelect('interview.candidate', 'candidate')
      .leftJoinAndSelect('interview.jobOpening', 'jobOpening')
      .where('interview.tenantId = :tenantId', { tenantId })
      .andWhere('interview.tenantMemberId = :tenantMemberId', {
        tenantMemberId,
      })
      .andWhere('interview.status = :status', { status: 'COMPLETED' })
      .andWhere('interview.deletedAt IS NULL')
      .andWhere(
        '(interview.feedback IS NULL OR JSON_LENGTH(interview.feedback) = 0)',
      );
    return queryBuilder.orderBy('interview.date', 'DESC').getMany();
  }
  async checkInterviewConflict(
    tenantId: string,
    interviewerId: string,
    startDate: Date,
    duration: number,
    excludeInterviewId?: string,
  ): Promise<boolean> {
    const endDate = new Date(startDate.getTime() + duration * 60000); 
    const queryBuilder = this.interviewRepository
      .createQueryBuilder('interview')
      .where('interview.tenantId = :tenantId', { tenantId })
      .andWhere('interview.status = :status', { status: 'SCHEDULED' })
      .andWhere('interview.deletedAt IS NULL')
      .andWhere(
        "JSON_EXTRACT(interview.interviewers, '$[*].userId') LIKE :interviewerId",
        { interviewerId: `%${interviewerId}%` },
      )
      .andWhere(
        '(interview.date < :endDate AND DATE_ADD(interview.date, INTERVAL interview.duration MINUTE) > :startDate)',
        { startDate, endDate },
      );
    if (excludeInterviewId) {
      queryBuilder.andWhere('interview.id != :excludeInterviewId', {
        excludeInterviewId,
      });
    }
    const conflictingInterviews = await queryBuilder.getMany();
    return conflictingInterviews.length > 0;
  }
  async getInterviewStatistics(
    tenantId: string,
    tenantMemberId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<{
    total: number;
    scheduled: number;
    completed: number;
    cancelled: number;
    byType: { phone: number; video: number; onsite: number };
    averageDuration: number;
  }> {
    const queryBuilder = this.interviewRepository
      .createQueryBuilder('interview')
      .where('interview.tenantId = :tenantId', { tenantId })
      .andWhere('interview.tenantMemberId = :tenantMemberId', {
        tenantMemberId,
      })
      .andWhere('interview.deletedAt IS NULL');
    if (dateFrom && dateTo) {
      queryBuilder.andWhere('interview.date BETWEEN :dateFrom AND :dateTo', {
        dateFrom,
        dateTo,
      });
    }
    const interviews = await queryBuilder.getMany();
    const stats = {
      total: interviews.length,
      scheduled: interviews.filter((i) => i.status === 'SCHEDULED').length,
      completed: interviews.filter((i) => i.status === 'COMPLETED').length,
      cancelled: interviews.filter((i) => i.status === 'CANCELLED').length,
      byType: {
        phone: interviews.filter((i) => i.type === 'PHONE').length,
        video: interviews.filter((i) => i.type === 'VIDEO').length,
        onsite: interviews.filter((i) => i.type === 'ONSITE').length,
      },
      averageDuration:
        interviews.length > 0
          ? Math.round(
              interviews.reduce((sum, i) => sum + i.duration, 0) /
                interviews.length,
            )
          : 0,
    };
    return stats;
  }
}
