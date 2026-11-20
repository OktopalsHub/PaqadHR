import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, RequireFeatures } from 'src/common/decorators';
import { RateLimit, RateLimitPresets } from 'src/common/decorators/rate-limit.decorator';
import { TenantMemberRole } from 'src/common/enums';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';

import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import {
  MoveCandidateStageDto,
  CreatePipelineStageDto,
  ReorderStagesDto,
  UpdatePipelineStageDto,
} from '../dto/pipeline-stage.dto';
import { DraftEmailDto, DraftJobDto } from '../dto/recruitment-ai.dto';
import {
  CreateEmailTemplateDto,
  PreviewEmailTemplateDto,
  SendCandidateEmailDto,
  UpdateEmailTemplateDto,
} from '../dto/recruitment-email-template.dto';
import { RecruitmentAiService } from '../services/recruitment-ai.service';
import { RecruitmentCandidateMailer } from '../services/recruitment-candidate-mailer.service';
import { RecruitmentEmailTemplateService } from '../services/recruitment-email-template.service';
import { RecruitmentPipelineService } from '../services/recruitment-pipeline.service';

@ApiTags('Recruitment ATS')
@Controller('tenants/:tenantId/recruitment')
@UseGuards(TenantMemberGuard, TenantRoleGuard)
@Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
@RequireFeatures(FeatureAccess.RECRUITMENT)
export class RecruitmentAtsController {
  constructor(
    private readonly pipeline: RecruitmentPipelineService,
    private readonly templates: RecruitmentEmailTemplateService,
    private readonly mailer: RecruitmentCandidateMailer,
    private readonly ai: RecruitmentAiService,
  ) {}

  @Get('email-templates')
  listTemplates(@Param('tenantId') tenantId: string) {
    return this.templates.list(tenantId);
  }

  @Get('email-templates/variables')
  templateVariables() {
    return { variables: this.templates.variables() };
  }

  @Post('email-templates/preview')
  previewTemplate(@Body() dto: PreviewEmailTemplateDto) {
    return this.templates.preview(dto);
  }

  @Post('email-templates')
  createTemplate(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateEmailTemplateDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.templates.create(tenantId, member.id, dto);
  }

  @Patch('email-templates/:templateId')
  updateTemplate(
    @Param('tenantId') tenantId: string,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.templates.update(tenantId, templateId, dto);
  }

  @Delete('email-templates/:templateId')
  async deleteTemplate(
    @Param('tenantId') tenantId: string,
    @Param('templateId') templateId: string,
  ) {
    await this.templates.remove(tenantId, templateId);
    return { deleted: true };
  }

  @Get('pipeline')
  getPipeline(@Param('tenantId') tenantId: string, @Query('jobOpeningId') jobOpeningId?: string) {
    return this.pipeline.getStages(tenantId, jobOpeningId ?? null);
  }

  @Post('pipeline/stages')
  addStage(@Param('tenantId') tenantId: string, @Body() dto: CreatePipelineStageDto) {
    const { jobOpeningId, ...input } = dto;
    return this.pipeline.addStage(tenantId, input, jobOpeningId ?? null);
  }

  @Patch('pipeline/stages/:stageId')
  updateStage(
    @Param('tenantId') tenantId: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpdatePipelineStageDto,
  ) {
    return this.pipeline.updateStage(tenantId, stageId, dto);
  }

  @Put('pipeline/order')
  reorder(@Param('tenantId') tenantId: string, @Body() dto: ReorderStagesDto) {
    return this.pipeline.reorder(tenantId, dto.stageIds, dto.jobOpeningId ?? null);
  }

  @Delete('pipeline/stages/:stageId')
  async deleteStage(@Param('tenantId') tenantId: string, @Param('stageId') stageId: string) {
    await this.pipeline.removeStage(tenantId, stageId);
    return { deleted: true };
  }

  @Post('candidates/:candidateId/stage')
  @RateLimit(RateLimitPresets.SENSITIVE)
  moveCandidate(
    @Param('tenantId') tenantId: string,
    @Param('candidateId') candidateId: string,
    @Body() dto: MoveCandidateStageDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.pipeline.moveCandidate({
      tenantId,
      candidateId,
      stageId: dto.stageId,
      reason: dto.reason,
      actorMemberId: member.id,
    });
  }

  @Get('candidates/:candidateId/timeline')
  async timeline(@Param('tenantId') tenantId: string, @Param('candidateId') candidateId: string) {
    const [stages, emails] = await Promise.all([
      this.pipeline.stageHistory(tenantId, candidateId),
      this.mailer.history(tenantId, candidateId),
    ]);
    return { stages, emails };
  }

  @Post('candidates/:candidateId/emails')
  @RateLimit(RateLimitPresets.SENSITIVE)
  async sendEmail(
    @Param('tenantId') tenantId: string,
    @Param('candidateId') candidateId: string,
    @Body() dto: SendCandidateEmailDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const log = await this.mailer.send({
      tenantId,
      candidateId,
      templateId: dto.templateId,
      actorMemberId: member.id,
      trigger: 'manual',
    });
    return { id: log.id, status: log.status, subject: log.subject };
  }

  @Post('candidates/:candidateId/ai-screening')
  @RateLimit(RateLimitPresets.SENSITIVE)
  screenCandidate(@Param('tenantId') tenantId: string, @Param('candidateId') candidateId: string) {
    return this.ai.screenCandidate(tenantId, candidateId);
  }

  @Post('ai/email-draft')
  @RateLimit(RateLimitPresets.SENSITIVE)
  draftEmail(@Body() dto: DraftEmailDto) {
    return this.ai.draftEmail(dto);
  }

  @Post('ai/job-draft')
  @RateLimit(RateLimitPresets.SENSITIVE)
  draftJob(@Body() dto: DraftJobDto) {
    return this.ai.draftJob(dto);
  }
}
