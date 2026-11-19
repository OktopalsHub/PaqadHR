import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, RequireFeatures } from 'src/common/decorators';
import { RateLimit, RateLimitPresets } from 'src/common/decorators/rate-limit.decorator';
import { TenantMemberRole } from 'src/common/enums';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';

import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import {
  CreateOfferDto,
  RespondOfferDto,
  SendOfferDto,
  SubmitScorecardDto,
  TalentPoolDto,
} from '../dto/recruitment-extras.dto';
import { RecruitmentOfferService } from '../services/recruitment-offer.service';
import { RecruitmentScorecardService } from '../services/recruitment-scorecard.service';
import { RecruitmentTalentPoolService } from '../services/recruitment-talent-pool.service';

@ApiTags('Recruitment ATS')
@Controller('tenants/:tenantId/recruitment')
@UseGuards(TenantMemberGuard, TenantRoleGuard)
@Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
@RequireFeatures(FeatureAccess.RECRUITMENT)
export class RecruitmentExtrasController {
  constructor(
    private readonly scorecards: RecruitmentScorecardService,
    private readonly offers: RecruitmentOfferService,
    private readonly pool: RecruitmentTalentPoolService,
  ) {}

  @Get('candidates/:candidateId/scorecards')
  listScorecards(@Param('tenantId') tenantId: string, @Param('candidateId') candidateId: string) {
    return this.scorecards.list(tenantId, candidateId);
  }

  @Post('candidates/:candidateId/scorecards')
  submitScorecard(
    @Param('tenantId') tenantId: string,
    @Param('candidateId') candidateId: string,
    @Body() dto: SubmitScorecardDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.scorecards.submit(tenantId, candidateId, member.id, dto);
  }

  @Get('candidates/:candidateId/offers')
  listOffers(@Param('tenantId') tenantId: string, @Param('candidateId') candidateId: string) {
    return this.offers.list(tenantId, candidateId);
  }

  @Post('candidates/:candidateId/offers')
  @RateLimit(RateLimitPresets.SENSITIVE)
  createOffer(
    @Param('tenantId') tenantId: string,
    @Param('candidateId') candidateId: string,
    @Body() dto: CreateOfferDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.offers.create(tenantId, candidateId, member.id, dto);
  }

  @Post('offers/:offerId/send')
  @RateLimit(RateLimitPresets.SENSITIVE)
  sendOffer(
    @Param('tenantId') tenantId: string,
    @Param('offerId') offerId: string,
    @Body() dto: SendOfferDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.offers.send(tenantId, offerId, member.id, dto.templateId);
  }

  @Post('offers/:offerId/respond')
  @RateLimit(RateLimitPresets.SENSITIVE)
  respondToOffer(
    @Param('tenantId') tenantId: string,
    @Param('offerId') offerId: string,
    @Body() dto: RespondOfferDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.offers.respond(tenantId, offerId, member.id, dto.outcome);
  }

  @Get('talent-pool')
  listTalentPool(@Param('tenantId') tenantId: string) {
    return this.pool.list(tenantId);
  }

  @Post('candidates/:candidateId/talent-pool')
  setTalentPool(
    @Param('tenantId') tenantId: string,
    @Param('candidateId') candidateId: string,
    @Body() dto: TalentPoolDto,
  ) {
    return this.pool.setMembership(tenantId, candidateId, dto.inPool);
  }
}
