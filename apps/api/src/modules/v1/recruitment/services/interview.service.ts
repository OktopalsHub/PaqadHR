import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InterviewStatus } from 'src/common/enums';
import type { InterviewFilters } from 'src/common/interfaces';
import { Repository } from 'typeorm';
import type {
  AddFeedbackDto,
  CreateInterviewDto,
  InterviewFeedbackDto,
} from '../dto/interview.dto';
import type { UpdateInterviewDto } from '../dto/update-interview.dto';
import { Candidate } from '../entities/candidate.entity';
import type { Interview } from '../entities/interview.entity';
import { JobOpening } from '../entities/job-opening.entity';
import { InterviewRepository } from '../repositories/interview.repository';

@Injectable()
export class InterviewService {
  constructor(
    private readonly interviewRepository: InterviewRepository,
    @InjectRepository(Candidate)
    private readonly candidateRepository: Repository<Candidate>,
    @InjectRepository(JobOpening)
    private readonly jobOpeningRepository: Repository<JobOpening>,
  ) {}
  async createInterview(
    tenantId: string,
    tenantMemberId: string,
    createInterviewDto: CreateInterviewDto,
  ): Promise<Interview> {
    if (new Date(createInterviewDto.date) <= new Date()) {
      throw new BadRequestException('Interview date must be in the future');
    }
    for (const interviewer of createInterviewDto.interviewers) {
      const hasConflict = await this.interviewRepository.checkInterviewConflict(
        tenantId,
        interviewer.userId,
        typeof createInterviewDto.date === 'string'
          ? new Date(createInterviewDto.date)
          : createInterviewDto.date,
        createInterviewDto.duration,
      );
      if (hasConflict) {
        throw new ConflictException(
          `Interviewer ${interviewer.role} has a scheduling conflict at the requested time`,
        );
      }
    }
    const candidate = await this.candidateRepository.findOne({
      where: { id: createInterviewDto.candidateId, tenantId },
    });
    if (!candidate) {
      throw new NotFoundException('Candidate not found or does not belong to this tenant');
    }
    const jobOpening = await this.jobOpeningRepository.findOne({
      where: { id: createInterviewDto.jobOpeningId, tenantId },
    });
    if (!jobOpening) {
      throw new NotFoundException('Job opening not found or does not belong to this tenant');
    }
    return this.interviewRepository.create({
      ...createInterviewDto,
      tenantId,
      tenantMemberId,
      status: InterviewStatus.SCHEDULED,
    });
  }
  async getInterviews(
    tenantId: string,
    tenantMemberId: string,
    filters?: InterviewFilters,
  ): Promise<Interview[]> {
    const processedFilters = filters
      ? {
          ...filters,
          dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
          dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
        }
      : undefined;
    return this.interviewRepository.findAllByTenantMember(
      tenantId,
      tenantMemberId,
      processedFilters,
    );
  }
  async getInterview(
    interviewId: string,
    tenantId: string,
    tenantMemberId: string,
  ): Promise<Interview> {
    return this.interviewRepository.findByTenantMemberAndId(tenantId, tenantMemberId, interviewId);
  }
  async updateInterview(
    interviewId: string,
    tenantId: string,
    tenantMemberId: string,
    updateInterviewDto: UpdateInterviewDto,
  ): Promise<Interview> {
    const existingInterview = await this.getInterview(interviewId, tenantId, tenantMemberId);
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
  ): Promise<Interview> {
    const interview = await this.getInterview(interviewId, tenantId, tenantMemberId);
    if (interview.status !== 'SCHEDULED') {
      throw new ForbiddenException('Only scheduled interviews can be cancelled');
    }
    return this.updateInterview(interviewId, tenantId, tenantMemberId, {
      status: InterviewStatus.CANCELLED,
    });
  }
  async completeInterview(
    interviewId: string,
    tenantId: string,
    tenantMemberId: string,
  ): Promise<Interview> {
    const interview = await this.getInterview(interviewId, tenantId, tenantMemberId);
    if (interview.status !== 'SCHEDULED') {
      throw new ForbiddenException('Only scheduled interviews can be completed');
    }
    if (new Date(interview.date) > new Date()) {
      throw new BadRequestException('Cannot complete future interviews');
    }
    return this.updateInterview(interviewId, tenantId, tenantMemberId, {
      status: InterviewStatus.COMPLETED,
    });
  }
  async addFeedback(
    interviewId: string,
    tenantId: string,
    tenantMemberId: string,
    userId: string,
    addFeedbackDto: AddFeedbackDto,
  ): Promise<Interview> {
    const interview = await this.getInterview(interviewId, tenantId, tenantMemberId);
    if (interview.status !== InterviewStatus.COMPLETED) {
      throw new ForbiddenException('Can only add feedback to completed interviews');
    }
    const isInterviewer = interview.interviewers.some(
      (interviewer) => interviewer.userId === userId,
    );
    if (!isInterviewer) {
      throw new ForbiddenException('Only interviewers can add feedback');
    }
    const existingFeedback = interview.feedback || [];
    const hasExistingFeedback = existingFeedback.some((feedback) => feedback.userId === userId);
    if (hasExistingFeedback) {
      throw new ConflictException('User has already provided feedback for this interview');
    }
    const newFeedback: InterviewFeedbackDto = {
      userId,
      ...addFeedbackDto,
      submittedAt: new Date(),
    };
    const updatedFeedback = [...existingFeedback, newFeedback];
    await this.interviewRepository.update(interviewId, {
      feedback: updatedFeedback,
    });
    const updatedInterview = await this.interviewRepository.findOne({
      where: { id: interviewId },
    });
    if (!updatedInterview) {
      throw new NotFoundException('Interview not found');
    }
    return updatedInterview;
  }
  async updateFeedback(
    interviewId: string,
    tenantId: string,
    tenantMemberId: string,
    userId: string,
    addFeedbackDto: AddFeedbackDto,
  ): Promise<Interview> {
    const interview = await this.getInterview(interviewId, tenantId, tenantMemberId);
    if (interview.status !== 'COMPLETED') {
      throw new ForbiddenException('Can only update feedback for completed interviews');
    }
    const existingFeedback = interview.feedback || [];
    const feedbackIndex = existingFeedback.findIndex((feedback) => feedback.userId === userId);
    if (feedbackIndex === -1) {
      throw new NotFoundException('No existing feedback found for this user');
    }
    const updatedFeedback = [...existingFeedback];
    updatedFeedback[feedbackIndex] = {
      userId,
      ...addFeedbackDto,
      submittedAt: new Date(),
    };
    await this.interviewRepository.update(interviewId, {
      feedback: updatedFeedback,
    });
    const updatedInterview = await this.interviewRepository.findOne({
      where: { id: interviewId },
    });
    if (!updatedInterview) {
      throw new NotFoundException('Interview not found');
    }
    return updatedInterview;
  }
  async deleteInterview(
    interviewId: string,
    tenantId: string,
    tenantMemberId: string,
  ): Promise<void> {
    const interview = await this.getInterview(interviewId, tenantId, tenantMemberId);
    if (interview.status !== 'SCHEDULED') {
      throw new ForbiddenException('Only scheduled interviews can be deleted');
    }
    await this.interviewRepository.softDelete(interviewId);
  }
  async getInterviewsByCandidate(
    candidateId: string,
    tenantId: string,
    tenantMemberId: string,
  ): Promise<Interview[]> {
    return this.interviewRepository.findByCandidate(candidateId, tenantId, tenantMemberId);
  }
  async getInterviewsByJobOpening(
    jobOpeningId: string,
    tenantId: string,
    tenantMemberId: string,
  ): Promise<Interview[]> {
    return this.interviewRepository.findByJobOpening(jobOpeningId, tenantId, tenantMemberId);
  }
  async getUpcomingInterviews(
    tenantId: string,
    tenantMemberId: string,
    days: number = 7,
  ): Promise<Interview[]> {
    return this.interviewRepository.findUpcomingInterviews(tenantId, tenantMemberId, days);
  }
  async getTodaysInterviews(tenantId: string, tenantMemberId: string): Promise<Interview[]> {
    return this.interviewRepository.findTodaysInterviews(tenantId, tenantMemberId);
  }
  async getInterviewsByInterviewer(
    interviewerId: string,
    tenantId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<Interview[]> {
    return this.interviewRepository.findByInterviewer(interviewerId, tenantId, dateFrom, dateTo);
  }
  async getInterviewsRequiringFeedback(
    tenantId: string,
    tenantMemberId: string,
  ): Promise<Interview[]> {
    return this.interviewRepository.findInterviewsRequiringFeedback(tenantId, tenantMemberId);
  }
  async getInterviewStatistics(
    tenantId: string,
    tenantMemberId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ) {
    return this.interviewRepository.getInterviewStatistics(
      tenantId,
      tenantMemberId,
      dateFrom,
      dateTo,
    );
  }
  async getInterviewStatusCounts(
    tenantId: string,
    tenantMemberId: string,
  ): Promise<{
    scheduled: number;
    completed: number;
    cancelled: number;
  }> {
    const [scheduled, completed, cancelled] = await Promise.all([
      this.interviewRepository.countByStatus(tenantId, tenantMemberId, InterviewStatus.SCHEDULED),
      this.interviewRepository.countByStatus(tenantId, tenantMemberId, InterviewStatus.COMPLETED),
      this.interviewRepository.countByStatus(tenantId, tenantMemberId, InterviewStatus.CANCELLED),
    ]);
    return { scheduled, completed, cancelled };
  }
  async rescheduleInterview(
    interviewId: string,
    tenantId: string,
    tenantMemberId: string,
    newDate: Date,
    newDuration?: number,
  ): Promise<Interview> {
    const interview = await this.getInterview(interviewId, tenantId, tenantMemberId);
    if (interview.status !== 'SCHEDULED') {
      throw new ForbiddenException('Only scheduled interviews can be rescheduled');
    }
    if (newDate <= new Date()) {
      throw new BadRequestException('New interview date must be in the future');
    }
    const duration = newDuration || interview.duration;
    for (const interviewer of interview.interviewers) {
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
    return this.updateInterview(interviewId, tenantId, tenantMemberId, {
      date: typeof newDate === 'string' ? newDate : newDate.toISOString(),
      duration,
    });
  }
  async bulkCancelInterviews(
    interviewIds: string[],
    tenantId: string,
    tenantMemberId: string,
  ): Promise<Interview[]> {
    const results: Interview[] = [];
    for (const interviewId of interviewIds) {
      try {
        const cancelled = await this.cancelInterview(interviewId, tenantId, tenantMemberId);
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
