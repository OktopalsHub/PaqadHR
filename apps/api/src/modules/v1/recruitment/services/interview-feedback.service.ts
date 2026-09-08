import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AddFeedbackDto, InterviewFeedbackDto } from '../dto/interview.dto';
import type { Interview } from '../entities/interview.entity';
import { InterviewRepository } from '../repositories/interview.repository';

@Injectable()
export class InterviewFeedbackService {
  constructor(private readonly interviewRepository: InterviewRepository) {}

  async addFeedback(
    interviewId: string,
    tenantId: string,
    tenantMemberId: string,
    userId: string,
    addFeedbackDto: AddFeedbackDto,
    existingInterview: Interview,
  ): Promise<Interview> {
    if (existingInterview.status !== 'COMPLETED') {
      throw new ForbiddenException('Can only add feedback to completed interviews');
    }
    const isInterviewer = existingInterview.interviewers.some(
      (interviewer) => interviewer.userId === userId,
    );
    if (!isInterviewer) {
      throw new ForbiddenException('Only interviewers can add feedback');
    }
    const existingFeedback = existingInterview.feedback || [];
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
    existingInterview: Interview,
  ): Promise<Interview> {
    if (existingInterview.status !== 'COMPLETED') {
      throw new ForbiddenException('Can only update feedback for completed interviews');
    }
    const existingFeedback = existingInterview.feedback || [];
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
}
