import { Tenant } from '../../tenants/entities/tenant.entity';
import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileUrlService } from 'src/common/services/file-url.service';
import { CandidateService } from '../services/candidate.service';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { CandidateMapper } from "../dto/candidate-response.dto";
import { UpdateCandidateStatusDto } from "../dto/update-candidate-status.dto";

@ApiTags('Tenant Candidates')
@Controller('tenants/:tenantId/candidates')
@UseGuards(TenantMemberGuard)
export class CandidateController {
  constructor(
    private readonly candidateService: CandidateService,
    private readonly fileUrlService: FileUrlService,
  ) {}
  @Get()
  async getCandidatesByTenant(@Param('tenantId') tenantId: string) {
    const candidates =
      await this.candidateService.getCandidatesByTenant(tenantId);
    return CandidateMapper.toResponseList(candidates, this.fileUrlService);
  }
  @Get(':candidateId')
  async getCandidate(
    @Param('candidateId') candidateId: string,
    @Param('tenantId') tenantId: string,
  ) {
    const candidate = await this.candidateService.getCandidate(
      candidateId,
      tenantId,
    );
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
  @Get('jobs/:jobId')
  async getCandidatesByJob(
    @Param('jobId') jobId: string,
    @Param('tenantId') tenantId: string,
  ) {
    const candidates = await this.candidateService.getCandidatesByJob(
      jobId,
      tenantId,
    );
    return CandidateMapper.toResponseList(candidates, this.fileUrlService);
  }
}
