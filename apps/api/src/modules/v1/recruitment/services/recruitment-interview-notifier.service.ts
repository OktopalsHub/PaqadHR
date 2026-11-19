import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Candidate } from '../entities/candidate.entity';
import type { Interview } from '../entities/interview.entity';
import { JobOpening } from '../entities/job-opening.entity';
import { RecruitmentEmailLog } from '../entities/recruitment-email-log.entity';
import {
  buildInterviewEmail,
  buildInterviewIcs,
  type InterviewInviteKind,
} from './recruitment-interview-invite';
import { htmlToText } from './recruitment-template-renderer';

@Injectable()
export class RecruitmentInterviewNotifier {
  private readonly logger = new Logger(RecruitmentInterviewNotifier.name);

  constructor(
    private readonly email: ZeptomailEmailService,
    @InjectRepository(Candidate) private readonly candidates: Repository<Candidate>,
    @InjectRepository(JobOpening) private readonly jobs: Repository<JobOpening>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(RecruitmentEmailLog) private readonly logs: Repository<RecruitmentEmailLog>,
  ) {}

  /** Best effort: a failed email never blocks scheduling, but is logged on the candidate. */
  async notify(
    kind: InterviewInviteKind,
    interview: Pick<
      Interview,
      'id' | 'tenantId' | 'candidateId' | 'jobOpeningId' | 'date' | 'duration' | 'type' | 'location'
    >,
    actorMemberId?: string,
  ): Promise<void> {
    try {
      const [candidate, job, tenant] = await Promise.all([
        this.candidates.findOne({
          where: { id: interview.candidateId, tenantId: interview.tenantId },
          select: { id: true, email: true, firstName: true },
        }),
        this.jobs.findOne({
          where: { id: interview.jobOpeningId },
          select: { id: true, title: true },
        }),
        this.tenants.findOne({
          where: { id: interview.tenantId },
          select: { id: true, name: true },
        }),
      ]);
      if (!candidate) return;
      const content = buildInterviewEmail({
        kind,
        interviewId: interview.id,
        candidateFirstName: candidate.firstName,
        jobTitle: job?.title ?? 'the role',
        companyName: tenant?.name ?? '',
        start: new Date(interview.date),
        durationMinutes: interview.duration,
        type: interview.type,
        location: interview.location,
      });
      const ics = buildInterviewIcs({
        kind,
        interviewId: interview.id,
        candidateFirstName: candidate.firstName,
        jobTitle: job?.title ?? 'the role',
        companyName: tenant?.name ?? '',
        start: new Date(interview.date),
        durationMinutes: interview.duration,
        type: interview.type,
        location: interview.location,
      });
      const result = await this.email.sendEmail({
        to: candidate.email,
        subject: content.subject,
        html: content.html,
        text: htmlToText(content.html),
        attachments: [
          {
            filename: 'interview.ics',
            content: Buffer.from(ics).toString('base64'),
            contentType: 'text/calendar',
          },
        ],
      });
      await this.logs.save(
        this.logs.create({
          tenantId: interview.tenantId,
          candidateId: candidate.id,
          templateId: null,
          recipientEmail: candidate.email,
          subject: content.subject,
          status: result.success ? 'sent' : 'failed',
          error: result.success ? null : (result.error ?? 'Send failed'),
          providerMessageId: result.messageId ?? null,
          sentByMemberId: actorMemberId ?? null,
          trigger: 'stage',
        }),
      );
    } catch (error) {
      this.logger.warn(`Interview ${kind} email failed: ${(error as Error).name}`);
    }
  }
}
