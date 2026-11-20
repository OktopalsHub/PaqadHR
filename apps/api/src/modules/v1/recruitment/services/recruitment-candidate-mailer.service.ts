import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FileUrlService } from 'src/common/services/file-url.service';
import { Repository } from 'typeorm';

import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Candidate } from '../entities/candidate.entity';
import { JobOpening } from '../entities/job-opening.entity';
import { RecruitmentEmailLog } from '../entities/recruitment-email-log.entity';
import { RecruitmentEmailTemplateService } from './recruitment-email-template.service';

export type CandidateEmailInput = {
  tenantId: string;
  candidateId: string;
  templateId: string;
  actorMemberId?: string | null;
  actorName?: string;
  stageName?: string;
  trigger: 'manual' | 'stage';
};

@Injectable()
export class RecruitmentCandidateMailer {
  private readonly logger = new Logger(RecruitmentCandidateMailer.name);

  constructor(
    private readonly templates: RecruitmentEmailTemplateService,
    private readonly email: ZeptomailEmailService,
    private readonly fileUrls: FileUrlService,
    @InjectRepository(Candidate) private readonly candidates: Repository<Candidate>,
    @InjectRepository(JobOpening) private readonly jobs: Repository<JobOpening>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(RecruitmentEmailLog) private readonly logs: Repository<RecruitmentEmailLog>,
  ) {}

  async send(input: CandidateEmailInput): Promise<RecruitmentEmailLog> {
    const candidate = await this.candidates.findOne({
      where: { id: input.candidateId, tenantId: input.tenantId },
      select: { id: true, email: true, firstName: true, lastName: true, jobOpeningId: true },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');
    const template = await this.templates.get(input.tenantId, input.templateId);
    const [job, tenant] = await Promise.all([
      this.jobs.findOne({
        where: { id: candidate.jobOpeningId },
        select: { id: true, title: true },
      }),
      this.tenants.findOne({
        where: { id: input.tenantId },
        select: { id: true, name: true, logoKey: true },
      }),
    ]);

    const logoUrl = tenant?.logoKey
      ? this.fileUrls.getTenantLogoUrl(input.tenantId, tenant.logoKey)
      : null;
    const rendered = this.templates.render(
      template,
      {
        'candidate.firstName': candidate.firstName,
        'candidate.lastName': candidate.lastName,
        'candidate.fullName': `${candidate.firstName} ${candidate.lastName}`.trim(),
        'job.title': job?.title ?? '',
        'company.name': tenant?.name ?? '',
        'stage.name': input.stageName ?? '',
        'sender.name': input.actorName ?? tenant?.name ?? '',
      },
      logoUrl,
    );

    const result = await this.email.sendEmail({
      to: candidate.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    if (!result.success) this.logger.warn(`Recruitment email ${template.id} failed to send`);

    return this.logs.save(
      this.logs.create({
        tenantId: input.tenantId,
        candidateId: candidate.id,
        templateId: template.id,
        recipientEmail: candidate.email,
        subject: rendered.subject,
        status: result.success ? 'sent' : 'failed',
        error: result.success ? null : (result.error ?? 'Send failed'),
        providerMessageId: result.messageId ?? null,
        sentByMemberId: input.actorMemberId ?? null,
        trigger: input.trigger,
      }),
    );
  }

  history(tenantId: string, candidateId: string) {
    return this.logs.find({
      where: { tenantId, candidateId },
      select: {
        id: true,
        templateId: true,
        subject: true,
        status: true,
        trigger: true,
        createdAt: true,
      },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}
