import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, RequireFeatures } from 'src/common/decorators';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { FeatureAccessGuard } from 'src/common/guards/feature-access.guard';
import type { MemberContext } from 'src/common/interfaces';
import { FileUrlService } from 'src/common/services/file-url.service';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { CandidateMapper } from '../dto/candidate-response.dto';
import { CreatePipelineCandidateDto } from '../dto/create-pipeline-candidate.dto';
import { UpdateCandidateStatusDto } from '../dto/update-candidate-status.dto';
import { CandidateService } from '../services/candidate.service';

@ApiTags('Tenant Candidates')
@Controller('tenants/:tenantId/candidates')
@UseGuards(TenantMemberGuard, FeatureAccessGuard)
@RequireFeatures(FeatureAccess.RECRUITMENT)
export class CandidateController {
  constructor(
    private readonly candidateService: CandidateService,
    private readonly fileUrlService: FileUrlService,
  ) {}
  @Post()
  async createCandidate(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreatePipelineCandidateDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const candidate = await this.candidateService.createPipelineCandidate(tenantId, member.id, dto);
    return CandidateMapper.toResponse(candidate, this.fileUrlService);
  }
  @Get()
  async getCandidatesByTenant(@Param('tenantId') tenantId: string) {
    const candidates = await this.candidateService.getCandidatesByTenant(tenantId);
    return CandidateMapper.toResponseList(candidates, this.fileUrlService);
  }
  @Get('jobs/:jobId')
  async getCandidatesByJob(@Param('jobId') jobId: string, @Param('tenantId') tenantId: string) {
    const candidates = await this.candidateService.getCandidatesByJob(jobId, tenantId);
    return CandidateMapper.toResponseList(candidates, this.fileUrlService);
  }
  @Get(':candidateId')
  async getCandidate(
    @Param('candidateId') candidateId: string,
    @Param('tenantId') tenantId: string,
  ) {
    const candidate = await this.candidateService.getCandidate(candidateId, tenantId);
    return CandidateMapper.toResponse(candidate, this.fileUrlService);
  }
  @Patch(':candidateId/status')
  async updateCandidateStatus(
    @Param('candidateId') candidateId: string,
    @Param('tenantId') tenantId: string,
    @Body() updateDto: UpdateCandidateStatusDto,
  ) {
    const updated = await this.candidateService.updateCandidateStatus(
      candidateId,
      tenantId,
      updateDto,
    );
    return CandidateMapper.toResponse(updated, this.fileUrlService);
  }
}
