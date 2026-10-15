import { ForbiddenException, Injectable } from '@nestjs/common';
import { InterviewStatus } from 'src/common/enums';
import type { InterviewFilters } from 'src/common/interfaces';
import type { AddFeedbackDto, CreateInterviewDto, UpdateInterviewDto } from '../dto/interview.dto';
import type { Interview } from '../entities/interview.entity';
import { InterviewRepository } from '../repositories/interview.repository';
import { InterviewFeedbackService } from './interview-feedback.service';
import { InterviewSchedulingService } from './interview-scheduling.service';

@Injectable()
export class InterviewService {
  constructor(
    private readonly interviewRepository: InterviewRepository,
    private readonly schedulingService: InterviewSchedulingService,
    private readonly feedbackService: InterviewFeedbackService,
  ) {}

  async createInterview(
    tenantId: string,
    tenantMemberId: string,
    createInterviewDto: CreateInterviewDto,
  ): Promise<Interview> {
    return this.schedulingService.createInterview(tenantId, tenantMemberId, createInterviewDto);
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
    return this.schedulingService.updateInterview(
      interviewId,
      tenantId,
      tenantMemberId,
      updateInterviewDto,
      existingInterview,
    );
  }

  async cancelInterview(
    interviewId: string,
    tenantId: string,
    tenantMemberId: string,
  ): Promise<Interview> {
    const interview = await this.getInterview(interviewId, tenantId, tenantMemberId);
    return this.schedulingService.cancelInterview(interviewId, tenantId, tenantMemberId, interview);
  }

  async completeInterview(
    interviewId: string,
    tenantId: string,
    tenantMemberId: string,
  ): Promise<Interview> {
    const interview = await this.getInterview(interviewId, tenantId, tenantMemberId);
    return this.schedulingService.completeInterview(
      interviewId,
      tenantId,
      tenantMemberId,
      interview,
    );
  }

  async addFeedback(
    interviewId: string,
    tenantId: string,
    tenantMemberId: string,
    userId: string,
    addFeedbackDto: AddFeedbackDto,
  ): Promise<Interview> {
    const interview = await this.getInterview(interviewId, tenantId, tenantMemberId);
    return this.feedbackService.addFeedback(
      interviewId,
      tenantId,
      tenantMemberId,
      userId,
      addFeedbackDto,
      interview,
    );
  }

  async updateFeedback(
    interviewId: string,
    tenantId: string,
    tenantMemberId: string,
    userId: string,
    addFeedbackDto: AddFeedbackDto,
  ): Promise<Interview> {
    const interview = await this.getInterview(interviewId, tenantId, tenantMemberId);
    return this.feedbackService.updateFeedback(
      interviewId,
      tenantId,
      tenantMemberId,
      userId,
      addFeedbackDto,
      interview,
    );
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
    return this.schedulingService.rescheduleInterview(
      interviewId,
      tenantId,
      tenantMemberId,
      newDate,
      newDuration,
      interview,
    );
  }

  async bulkCancelInterviews(
    interviewIds: string[],
    tenantId: string,
    tenantMemberId: string,
  ): Promise<Interview[]> {
    return this.schedulingService.bulkCancelInterviews(
      interviewIds,
      tenantId,
      tenantMemberId,
      (id, tid, mid) => this.getInterview(id, tid, mid),
    );
  }

  async checkInterviewerAvailability(
    tenantId: string,
    interviewerId: string,
    date: Date,
    duration: number,
    excludeInterviewId?: string,
  ): Promise<boolean> {
    return this.schedulingService.checkInterviewerAvailability(
      tenantId,
      interviewerId,
      date,
      duration,
      excludeInterviewId,
    );
  }

  async getInterviewerSchedule(
    tenantId: string,
    interviewerId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<Interview[]> {
    return this.schedulingService.getInterviewerSchedule(tenantId, interviewerId, dateFrom, dateTo);
  }
}
