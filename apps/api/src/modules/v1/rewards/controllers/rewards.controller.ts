import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import { MemberPointsService } from '../../shoutouts/services/member-points.service';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { CustomRewardsService } from '../services/custom-rewards.service';
import { type ClaimInput, RewardsService } from '../services/rewards.service';
import { TenantWalletService } from '../services/tenant-wallet.service';

const ALL_ROLES = [
  TenantMemberRole.OWNER,
  TenantMemberRole.ADMIN,
  TenantMemberRole.MEMBER,
] as const;
const ADMIN_ROLES = [TenantMemberRole.OWNER, TenantMemberRole.ADMIN] as const;

@ApiTags('Rewards')
@Controller('tenants/:tenantId/rewards')
@UseGuards(TenantMemberGuard)
export class RewardsController {
  constructor(
    private readonly rewardsService: RewardsService,
    private readonly walletService: TenantWalletService,
    private readonly customRewardsService: CustomRewardsService,
    private readonly memberPointsService: MemberPointsService,
  ) {}

  @Get('catalog')
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async getCatalog(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const role = member.role?.toLowerCase();
    const includeAdminPricing = role === 'owner' || role === 'admin';
    return this.rewardsService.getCatalog(tenantId, { includeAdminPricing });
  }

  @Post('catalog/sync')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Force sync Reloadly gift catalog into tenant settings' })
  async syncCatalog(@Param('tenantId') tenantId: string) {
    const products = await this.rewardsService.syncReloadlyProducts(tenantId, { force: true });
    return { synced: products.length, products };
  }

  @Get('countries')
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async getCountries(@Param('tenantId') tenantId: string) {
    return this.rewardsService.getReloadlyCountries(tenantId);
  }

  @Post('claim')
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
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async getMyClaims(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.rewardsService.getMyClaims(tenantId, member.id);
  }

  @Get('claims')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async getAllClaims(@Param('tenantId') tenantId: string) {
    return this.rewardsService.getAllClaims(tenantId);
  }

  @Get('wallet')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async getWallet(@Param('tenantId') tenantId: string) {
    const wallet = await this.walletService.getWallet(tenantId);
    const fees = await this.rewardsService.getRedemptionFees(tenantId, wallet.currencyCode);
    return {
      ...wallet,
      feePercentage: fees.feePercentage,
      flatFee: fees.flatFee,
    };
  }

  @Get('wallet/transactions')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async getWalletTransactions(@Param('tenantId') tenantId: string) {
    return this.walletService.listTransactions(tenantId);
  }

  @Post('wallet/provision-virtual-account')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Provision or retry Nomba virtual account for rewards wallet' })
  async provisionVirtualAccount(@Param('tenantId') tenantId: string) {
    const wallet = await this.walletService.provisionVirtualAccount(tenantId);
    const fees = await this.rewardsService.getRedemptionFees(tenantId, wallet.currencyCode);
    return {
      ...wallet,
      feePercentage: fees.feePercentage,
      flatFee: fees.flatFee,
    };
  }

  @Post('wallet/topup')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async manualTopup(@Param('tenantId') tenantId: string, @Body() body: { amount: number }) {
    return this.walletService.manualTopup(tenantId, body.amount);
  }

  @Post('wallet/topup/checkout')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Create Nomba checkout link to fund rewards wallet' })
  async topupCheckout(@Param('tenantId') tenantId: string, @Body() body: { amount: number }) {
    return this.walletService.createTopupCheckout(tenantId, Number(body.amount));
  }

  @Post('wallet/auto-topup')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async updateAutoTopup(
    @Param('tenantId') tenantId: string,
    @Body() body: { enabled: boolean; threshold: number; amount: number },
  ) {
    return this.walletService.updateAutoTopupConfig(
      tenantId,
      body.enabled,
      body.threshold,
      body.amount,
    );
  }

  @Post('assign-points')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async assignPoints(
    @Param('tenantId') tenantId: string,
    @Body() body: {
      memberIds?: string[];
      points?: number;
      reason?: string;
      assignments?: { memberId: string; points: number }[];
    },
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.memberPointsService.assignPoints(
      tenantId,
      body.memberIds ?? [],
      body.points ?? 0,
      body.reason,
      member.id,
      body.assignments,
    );
  }

  @Get('custom')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async listCustomRewards(@Param('tenantId') tenantId: string) {
    return this.customRewardsService.list(tenantId, true);
  }

  @Post('custom')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async createCustomReward(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      title: string;
      description?: string;
      pointsCost: number;
      imageUrl?: string;
      stockLimit?: number;
      deliveryInstructions?: string;
    },
  ) {
    return this.customRewardsService.create(tenantId, body);
  }

  @Patch('custom/:rewardId')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async updateCustomReward(
    @Param('tenantId') tenantId: string,
    @Param('rewardId') rewardId: string,
    @Body()
    body: Partial<{
      title: string;
      description: string;
      pointsCost: number;
      imageUrl: string;
      isActive: boolean;
      stockLimit: number;
      deliveryInstructions: string;
    }>,
  ) {
    return this.customRewardsService.update(tenantId, rewardId, body);
  }

  @Delete('custom/:rewardId')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async deleteCustomReward(
    @Param('tenantId') tenantId: string,
    @Param('rewardId') rewardId: string,
  ) {
    await this.customRewardsService.softDelete(tenantId, rewardId);
    return { success: true };
  }

  @Get('tasks')
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async listTasks(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.rewardsService.listTasks(tenantId, member.id);
  }

  @Get('tasks/submissions/pending')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async listPendingSubmissions(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.rewardsService.listPendingSubmissions(tenantId, member.id);
  }

  @Post('tasks')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async createTask(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      title: string;
      description: string;
      points: number;
      icon: string;
      category?: string;
      imageUrl?: string;
      submissionType: 'instant' | 'text' | 'file';
      isRecurring?: boolean;
    },
  ) {
    return this.rewardsService.createTask(tenantId, body);
  }

  @Delete('tasks/:taskId')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async deleteTask(@Param('tenantId') tenantId: string, @Param('taskId') taskId: string) {
    return this.rewardsService.deleteTask(tenantId, taskId);
  }

  @Post('tasks/:taskId/submit')
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async submitTask(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @CurrentTenantMember() member: MemberContext,
    @Body() body: { submissionText?: string; submissionFileName?: string },
  ) {
    return this.rewardsService.submitTask(tenantId, taskId, member.id, body);
  }

  @Post('tasks/:taskId/submissions/:submissionId/approve')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async approveSubmission(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Param('submissionId') submissionId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.rewardsService.approveSubmission(tenantId, taskId, submissionId, member.id);
  }

  @Post('tasks/:taskId/submissions/:submissionId/reject')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async rejectSubmission(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Param('submissionId') submissionId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.rewardsService.rejectSubmission(tenantId, taskId, submissionId, member.id);
  }

  @Get('operators/:countryCode')
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async listTopupOperators(@Param('countryCode') countryCode: string) {
    return this.rewardsService.listTopupOperators(countryCode);
  }

  @Get('data-plans/:network')
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async listNombaDataPlans(@Param('network') network: string) {
    return this.rewardsService.listNombaDataPlans(network);
  }

  @Get('utilities/billers/:countryCode')
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async listUtilityBillers(@Param('countryCode') countryCode: string) {
    return this.rewardsService.listUtilityBillers(countryCode);
  }

  @Post('utilities/lookup')
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

  @Get('calculate-points')
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
