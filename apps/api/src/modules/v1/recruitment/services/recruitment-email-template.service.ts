import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
} from '../dto/recruitment-email-template.dto';
import { RecruitmentEmailTemplate } from '../entities/recruitment-email-template.entity';
import { DEFAULT_EMAIL_TEMPLATES } from './recruitment-default-templates';
import {
  findUnknownVariables,
  htmlToText,
  RECRUITMENT_TEMPLATE_VARIABLES,
  type RecruitmentTemplateContext,
  renderRecruitmentTemplate,
} from './recruitment-template-renderer';

const TEMPLATE_COLUMNS = {
  id: true,
  name: true,
  subject: true,
  bodyHtml: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class RecruitmentEmailTemplateService {
  constructor(
    @InjectRepository(RecruitmentEmailTemplate)
    private readonly templates: Repository<RecruitmentEmailTemplate>,
  ) {}

  variables() {
    return RECRUITMENT_TEMPLATE_VARIABLES;
  }

  async list(tenantId: string) {
    const existing = await this.templates.count({ where: { tenantId } });
    if (existing === 0) await this.seedDefaults(tenantId);
    return this.templates.find({
      where: { tenantId },
      select: TEMPLATE_COLUMNS,
      order: { createdAt: 'ASC' },
    });
  }

  async get(tenantId: string, id: string) {
    const template = await this.templates.findOne({
      where: { id, tenantId },
      select: { ...TEMPLATE_COLUMNS, tenantId: true },
    });
    if (!template) throw new NotFoundException('Email template not found');
    return template;
  }

  async create(tenantId: string, memberId: string, dto: CreateEmailTemplateDto) {
    this.assertKnownVariables(dto.subject, dto.bodyHtml);
    return this.templates.save(
      this.templates.create({ ...dto, tenantId, createdByMemberId: memberId }),
    );
  }

  async update(tenantId: string, id: string, dto: UpdateEmailTemplateDto) {
    const template = await this.get(tenantId, id);
    this.assertKnownVariables(dto.subject ?? template.subject, dto.bodyHtml ?? template.bodyHtml);
    await this.templates.update({ id, tenantId }, dto);
    return this.get(tenantId, id);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.get(tenantId, id);
    await this.templates.delete({ id, tenantId });
  }

  render(
    template: Pick<RecruitmentEmailTemplate, 'subject' | 'bodyHtml'>,
    ctx: RecruitmentTemplateContext,
  ) {
    const html = renderRecruitmentTemplate(template.bodyHtml, ctx, { html: true });
    return {
      subject: renderRecruitmentTemplate(template.subject, ctx, { html: false }).slice(0, 255),
      html,
      text: htmlToText(html),
    };
  }

  private assertKnownVariables(subject: string, bodyHtml: string) {
    const unknown = findUnknownVariables(`${subject}\n${bodyHtml}`);
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown template variables: ${unknown.join(', ')}`);
    }
  }

  private async seedDefaults(tenantId: string) {
    await this.templates.insert(
      DEFAULT_EMAIL_TEMPLATES.map((template) => ({ ...template, tenantId, isActive: true })),
    );
  }
}
