import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CandidateStatus, InterviewStatus } from 'src/common/enums';
import { Repository } from 'typeorm';
import { ActivitiesService } from '../../activities/services/activities.service';
import type { CreateInterviewDto, UpdateInterviewDto } from '../dto/interview.dto';
import { Candidate } from '../entities/candidate.entity';
import { Interview } from '../entities/interview.entity';
import { JobOpening } from '../entities/job-opening.entity';
import { InterviewRepository } from '../repositories/interview.repository';

@Injectable()
export class InterviewSchedulingService {
  constructor(
    private readonly interviewRepository: InterviewRepository,
    @InjectRepository(Candidate)
    private readonly candidateRepository: Repository<Candidate>,
    @InjectRepository(JobOpening)
    private readonly jobOpeningRepository: Repository<JobOpening>,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async createInterview(
    tenantId: string,
    tenantMemberId: string,
    createInterviewDto: CreateInterviewDto,
  ): Promise<Interview> {
    if (new Date(createInterviewDto.date) <= new Date()) {
      throw new BadRequestException('Interview date must be in the future');
    }
    const interviewDate =
      typeof createInterviewDto.date === 'string'
        ? new Date(createInterviewDto.date)
        : createInterviewDto.date;
    const candidate = await this.candidateRepository.findOne({
      where: { id: createInterviewDto.candidateId, tenantId },
    });
    if (!candidate) {
      throw new NotFoundException('Candidate not found or does not belong to this tenant');
    }
    if (candidate.jobOpeningId !== createInterviewDto.jobOpeningId) {
      throw new BadRequestException('Candidate does not belong to the selected job opening');
    }
    if (
      [CandidateStatus.HIRED, CandidateStatus.REJECTED, CandidateStatus.WITHDRAWN].includes(
        candidate.status,
      )
    ) {
      throw new ConflictException(
        'Cannot schedule an interview for a candidate in the current status',
      );
    }
    const jobOpening = await this.jobOpeningRepository.findOne({
      where: { id: createInterviewDto.jobOpeningId, tenantId },
    });
    if (!jobOpening) {
      throw new NotFoundException('Job opening not found or does not belong to this tenant');
    }
    const interviewerIds = [
      ...new Set(createInterviewDto.interviewers.map((interviewer) => interviewer.userId)),
    ].sort();
    const saved = await this.interviewRepository.manager.transaction(async (manager) => {
      for (const interviewerId of interviewerIds) {
        await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0));', [
          `recruitment:interviewer:${tenantId}:${interviewerId}`,
        ]);
      }
      const interviewRepository = manager.getRepository(Interview);
      const endDate = new Date(interviewDate.getTime() + createInterviewDto.duration * 60000);
      const hasConflict = await Promise.all(
        interviewerIds.map(async (interviewerId) =>
          interviewRepository
            .createQueryBuilder('interview')
            .where('interview.tenantId = :tenantId', { tenantId })
            .andWhere('interview.status = :status', { status: InterviewStatus.SCHEDULED })
            .andWhere('interview.deletedAt IS NULL')
            .andWhere(
              `EXISTS (
                SELECT 1
                FROM jsonb_array_elements(interview.interviewers::jsonb) interviewer_elem
                WHERE interviewer_elem->>'userId' = :interviewerId
              )`,
              { interviewerId },
            )
            .andWhere(
              `interview.date < :endDate
                AND (interview.date + (interview.duration * interval '1 minute')) > :startDate`,
              { startDate: interviewDate, endDate },
            )
            .getExists(),
        ),
      );
      if (hasConflict.some(Boolean)) {
        throw new ConflictException(
          'One or more interviewers have a scheduling conflict at the requested time',
        );
      }
      const interview = interviewRepository.create({
        ...createInterviewDto,
        tenantId,
        tenantMemberId,
        status: InterviewStatus.SCHEDULED,
      });
      const savedInterview = await interviewRepository.save(interview);
      if (candidate.status !== CandidateStatus.INTERVIEW) {
        await manager.getRepository(Candidate).update(candidate.id, {
          status: CandidateStatus.INTERVIEW,
          currentStage: { name: CandidateStatus.INTERVIEW, startedAt: new Date() },
        });
      }
      return savedInterview;
    });

    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: tenantMemberId,
        action: 'recruitment.interview_scheduled',
        resourceType: 'interview',
        resourceId: saved.id,
        description: `Interview scheduled for candidate`,
        metadata: {
          candidateId: createInterviewDto.candidateId,
          jobOpeningId: createInterviewDto.jobOpeningId,
        },
      })
      .catch(() => {});

    return saved;
  }

  async updateInterview(
    interviewId: string,
    tenantId: string,
    tenantMemberId: string,
    updateInterviewDto: UpdateInterviewDto,
    existingInterview: Interview,
  ): Promise<Interview> {
    if (existingInterview.status !== 'SCHEDULED' && updateInterviewDto.status !== 'SCHEDULED') {
      throw new ForbiddenException('Cannot update completed or cancelled interviews');
    }
    if (updateInterviewDto.date && new Date(updateInterviewDto.date) <= new Date()) {
      throw new BadRequestException('Interview date must be in the future');
    }
    if (updateInterviewDto.date || updateInterviewDto.duration || updateInterviewDto.interviewers) {
      const interviewers = updateInterviewDto.interviewers || existingInterview.interviewers;
      const date = updateInterviewDto.date || existingInterview.date;
      const duration = updateInterviewDto.duration || existingInterview.duration;
      for (const interviewer of interviewers) {
        const hasConflict = await this.interviewRepository.checkInterviewConflict(
          tenantId,
          interviewer.userId,
          typeof date === 'string' ? new Date(date) : date,
          duration,
          interviewId,
        );
        if (hasConflict) {
          throw new ConflictException(
            `Interviewer ${interviewer.role} has a scheduling conflict at the requested time`,
          );
        }
      }
    }
    await this.interviewRepository.update(
      interviewId,
      updateInterviewDto as Parameters<typeof this.interviewRepository.update>[1],
    );
    const updatedInterview = await this.interviewRepository.findOne({
      where: { id: interviewId },
    });
    if (!updatedInterview) {
      throw new NotFoundException('Interview not found');
    }
    return updatedInterview;
  }

  async cancelInterview(
    interviewId: string,
    tenantId: string,
    tenantMemberId: string,
    existingInterview: Interview,
  ): Promise<Interview> {
    if (existingInterview.status !== 'SCHEDULED') {
      throw new ForbiddenException('Only scheduled interviews can be cancelled');
    }
    return this.updateInterview(
      interviewId,
      tenantId,
      tenantMemberId,
      {
        status: InterviewStatus.CANCELLED,
      },
      existingInterview,
    );
  }

  async completeInterview(
    interviewId: string,
    tenantId: string,
    tenantMemberId: string,
    existingInterview: Interview,
  ): Promise<Interview> {
    if (existingInterview.status !== 'SCHEDULED') {
      throw new ForbiddenException('Only scheduled interviews can be completed');
    }
    if (new Date(existingInterview.date) > new Date()) {
      throw new BadRequestException('Cannot complete future interviews');
    }
    return this.updateInterview(
      interviewId,
      tenantId,
      tenantMemberId,
      {
        status: InterviewStatus.COMPLETED,
      },
      existingInterview,
    );
  }

  async rescheduleInterview(
    interviewId: string,
    tenantId: string,
    tenantMemberId: string,
    newDate: Date,
    newDuration: number | undefined,
    existingInterview: Interview,
  ): Promise<Interview> {
    if (existingInterview.status !== 'SCHEDULED') {
      throw new ForbiddenException('Only scheduled interviews can be rescheduled');
    }
    if (newDate <= new Date()) {
      throw new BadRequestException('New interview date must be in the future');
    }
    const duration = newDuration || existingInterview.duration;
    for (const interviewer of existingInterview.interviewers) {
      const hasConflict = await this.interviewRepository.checkInterviewConflict(
        tenantId,
        interviewer.userId,
        newDate,
        duration,
        interviewId,
      );
      if (hasConflict) {
        throw new ConflictException(
          `Interviewer ${interviewer.role} has a scheduling conflict at the new time`,
        );
      }
    }
    return this.updateInterview(
      interviewId,
      tenantId,
      tenantMemberId,
      {
        date: typeof newDate === 'string' ? new Date(newDate) : newDate,
        duration,
      },
      existingInterview,
    );
  }

  async bulkCancelInterviews(
    interviewIds: string[],
    tenantId: string,
    tenantMemberId: string,
    getInterviewFn: (id: string, tenantId: string, member: string) => Promise<Interview>,
  ): Promise<Interview[]> {
    const results: Interview[] = [];
    for (const interviewId of interviewIds) {
      try {
        const interview = await getInterviewFn(interviewId, tenantId, tenantMemberId);
        const cancelled = await this.cancelInterview(
          interviewId,
          tenantId,
          tenantMemberId,
          interview,
        );
        results.push(cancelled);
      } catch (_error) {}
    }
    return results;
  }

  async checkInterviewerAvailability(
    tenantId: string,
    interviewerId: string,
    date: Date,
    duration: number,
    excludeInterviewId?: string,
  ): Promise<boolean> {
    const hasConflict = await this.interviewRepository.checkInterviewConflict(
      tenantId,
      interviewerId,
      typeof date === 'string' ? new Date(date) : date,
      duration,
      excludeInterviewId,
    );
    return !hasConflict;
  }

  async getInterviewerSchedule(
    tenantId: string,
    interviewerId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<Interview[]> {
    return this.interviewRepository.findByInterviewer(interviewerId, tenantId, dateFrom, dateTo);
  }
}
