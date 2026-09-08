import { Body, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentTenantMember } from 'src/common/decorators';
import { RequireFeatures } from 'src/common/decorators/feature-access.decorator';
import { TenantMemberRole } from 'src/common/enums';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import { type ClaimInput, RewardsService } from '../services/rewards.service';

const ALL_ROLES = [
  TenantMemberRole.OWNER,
  TenantMemberRole.ADMIN,
  TenantMemberRole.MEMBER,
] as const;
const ADMIN_ROLES = [TenantMemberRole.OWNER, TenantMemberRole.ADMIN] as const;

export class RewardsClaimsHandler {
  constructor(private readonly rewardsService: RewardsService) {}

  @Post('claim')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async claim(
    @Param('tenantId') tenantId: string,
    @Body() body: ClaimInput,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.rewardsService.claim(tenantId, member.id, body);
  }

  @Get('claims/me')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async getMyClaims(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.rewardsService.getMyClaims(tenantId, member.id);
  }

  @Get('claims')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async getAllClaims(@Param('tenantId') tenantId: string) {
    return this.rewardsService.getAllClaims(tenantId);
  }

  @Get('calculate-points')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async calculatePointsCost(
    @Param('tenantId') tenantId: string,
    @Query('type') type: string,
    @Query('billerId') billerId?: string,
    @Query('amount') amount?: string,
  ) {
    return this.rewardsService.calculatePointsCost(
      tenantId,
      type as 'airtime' | 'utility' | 'ng-airtime' | 'ng-utility',
      billerId ? Number(billerId) : 0,
      Number(amount) || 0,
    );
  }
}
