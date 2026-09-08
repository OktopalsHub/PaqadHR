import { Body, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { CurrentTenantMember } from 'src/common/decorators';
import { RequireFeatures } from 'src/common/decorators/feature-access.decorator';
import { TenantMemberRole } from 'src/common/enums';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import { CustomRewardsService } from '../services/custom-rewards.service';
import { RewardsService } from '../services/rewards.service';

const ALL_ROLES = [
  TenantMemberRole.OWNER,
  TenantMemberRole.ADMIN,
  TenantMemberRole.MEMBER,
] as const;
const ADMIN_ROLES = [TenantMemberRole.OWNER, TenantMemberRole.ADMIN] as const;

export class RewardsCatalogHandler {
  constructor(
    private readonly rewardsService: RewardsService,
    private readonly customRewardsService: CustomRewardsService,
  ) {}

  @Get('catalog')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async getCatalog(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
    @Query('country') country?: string,
  ) {
    const role = member.role?.toLowerCase();
    const includeAdminPricing = role === 'owner' || role === 'admin';
    return this.rewardsService.getCatalog(tenantId, { includeAdminPricing, countryCode: country });
  }

  @Post('catalog/sync')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Force sync gift catalog into tenant settings' })
  async syncCatalog(@Param('tenantId') tenantId: string) {
    const result = await this.rewardsService.syncCatalog(tenantId, { force: true });
    return { synced: result.count, providers: result.providers };
  }

  @Get('countries')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async getCountries(@Param('tenantId') tenantId: string) {
    return this.rewardsService.getCatalogCountries(tenantId);
  }

  @Get('providers')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async getProviderAvailability() {
    return this.rewardsService.getProviderAvailability();
  }

  @Get('data-plans/:network')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async listNombaDataPlans(@Param('network') network: string) {
    return this.rewardsService.listNombaDataPlans(network);
  }

  @Get('utilities/billers/:countryCode')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async listUtilityBillers(@Param('countryCode') countryCode: string) {
    return this.rewardsService.listUtilityBillers(countryCode);
  }

  @Post('utilities/lookup')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async lookupUtilityMeter(
    @Body() body: {
      countryCode: string;
      billerId: string;
      accountNumber: string;
      serviceType?: string;
    },
  ) {
    return this.rewardsService.lookupUtilityMeter(
      body.countryCode,
      body.billerId,
      body.accountNumber,
      body.serviceType,
    );
  }

  @Get('custom')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async listCustomRewards(@Param('tenantId') tenantId: string) {
    return this.customRewardsService.list(tenantId, true);
  }

  @Post('custom')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async createCustomReward(
    @Param('tenantId') tenantId: string,
    @Body() body: {
      name: string;
      pointsCost: number;
      description?: string;
      deliveryInstructions?: string;
      isActive?: boolean;
      stockLimit?: number | null;
      imageUrl?: string;
    },
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.customRewardsService.create(tenantId, body as never, member.id);
  }

  @Patch('custom/:rewardId')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async updateCustomReward(
    @Param('tenantId') tenantId: string,
    @Param('rewardId') rewardId: string,
    @Body() body: {
      name?: string;
      pointsCost?: number;
      description?: string;
      deliveryInstructions?: string;
      isActive?: boolean;
      stockLimit?: number | null;
      imageUrl?: string;
    },
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.customRewardsService.update(tenantId, rewardId, body as never, member.id);
  }

  @Delete('custom/:rewardId')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async deleteCustomReward(
    @Param('tenantId') tenantId: string,
    @Param('rewardId') rewardId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    await this.customRewardsService.softDelete(tenantId, rewardId, member.id);
    return { success: true };
  }
}
