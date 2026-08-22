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
import { isNombaLive } from 'src/common/config/nomba.config';
import { CurrentTenantMember } from 'src/common/decorators';
import { RequireFeatures } from 'src/common/decorators/feature-access.decorator';
import { TenantMemberRole } from 'src/common/enums';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import { MemberPointsService } from '../../shoutouts/services/member-points.service';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import {
  isRewardsWalletCheckoutLive,
  resolveRewardsWalletPaymentProvider,
} from '../config/rewards-wallet-provider.config';
import { AssignMemberPointsDto } from '../dto/assign-member-points.dto';
import { CreateCustomRewardDto, UpdateCustomRewardDto } from '../dto/custom-reward.dto';
import { WalletAutoTopupDto } from '../dto/wallet-auto-topup.dto';
import { WalletTopupCompleteDto, WalletTopupDto } from '../dto/wallet-topup.dto';
import { CustomRewardsService } from '../services/custom-rewards.service';
import { type ClaimInput, RewardsService } from '../services/rewards.service';
import { TenantWalletService } from '../services/tenant-wallet.service';
import { TenantWalletTopupService } from '../services/tenant-wallet-topup.service';
import { resolveWalletTopupProviderFromOrderRef } from '../utils/wallet-order-ref.util';

const ALL_ROLES = [
  TenantMemberRole.OWNER,
  TenantMemberRole.ADMIN,
  TenantMemberRole.MEMBER,
] as const;
const ADMIN_ROLES = [TenantMemberRole.OWNER, TenantMemberRole.ADMIN] as const;

async function withWalletResponse(
  wallet: Awaited<ReturnType<TenantWalletService['getWallet']>>,
  fees: { feePercentage: number; flatFee: number },
  tenantCountryCode?: string | null,
  currencyLocked?: boolean,
) {
  const checkoutProvider = resolveRewardsWalletPaymentProvider(
    tenantCountryCode,
    wallet.currencyCode,
  );
  const checkoutLive = isRewardsWalletCheckoutLive(checkoutProvider);

  return {
    id: wallet.id,
    tenantId: wallet.tenantId,
    currencyCode: wallet.currencyCode,
    currencyLocked: currencyLocked ?? false,
    balanceAmount: wallet.balanceAmount,
    pointsExchangeRate: wallet.pointsExchangeRate,
    autoTopupEnabled: wallet.autoTopupEnabled,
    autoTopupThreshold: wallet.autoTopupThreshold,
    autoTopupAmount: wallet.autoTopupAmount,
    feePercentage: fees.feePercentage,
    flatFee: fees.flatFee,
    checkoutLive,
    savedCardTopupSupported: checkoutProvider !== PaymentProvider.BACHS,
    /** @deprecated use checkoutLive */
    nombaLive: isNombaLive(),
  };
}

@ApiTags('Rewards')
@Controller('tenants/:tenantId/rewards')
@UseGuards(TenantMemberGuard)
export class RewardsController {
  constructor(
    private readonly rewardsService: RewardsService,
    private readonly walletService: TenantWalletService,
    private readonly walletTopupService: TenantWalletTopupService,
    private readonly customRewardsService: CustomRewardsService,
    private readonly memberPointsService: MemberPointsService,
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
    return this.rewardsService.getCatalog(tenantId, {
      includeAdminPricing,
      countryCode: country,
    });
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

  @Get('wallet')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async getWallet(@Param('tenantId') tenantId: string) {
    const wallet = await this.walletService.getWallet(tenantId);
    const [tenantCountryCode, currencyLocked] = await Promise.all([
      this.walletService.getTenantCountryCode(tenantId),
      this.walletService.isWalletCurrencyLockedForTenant(tenantId),
    ]);
    const fees = await this.rewardsService.getRedemptionFees(tenantId, wallet.currencyCode);
    return withWalletResponse(wallet, fees, tenantCountryCode, currencyLocked);
  }

  @Get('wallet/transactions')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async getWalletTransactions(@Param('tenantId') tenantId: string) {
    return this.walletService.listTransactions(tenantId);
  }

  @Post('wallet/topup')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async manualTopup(
    @Param('tenantId') tenantId: string,
    @Body() body: WalletTopupDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.walletTopupService.manualTopup(tenantId, body.amount, member.id);
  }

  @Post('wallet/topup/checkout')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Create checkout link to fund rewards wallet' })
  async topupCheckout(
    @Param('tenantId') tenantId: string,
    @Body() body: WalletTopupDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.walletTopupService.createTopupCheckout(tenantId, Number(body.amount), member.id);
  }

  @Post('wallet/topup/checkout/complete')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Verify and credit wallet after checkout redirect' })
  async completeTopupCheckout(
    @Param('tenantId') tenantId: string,
    @Body() body: WalletTopupCompleteDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const orderReference = body.orderReference.trim();
    const fromRef = resolveWalletTopupProviderFromOrderRef(orderReference, tenantId);
    const checkoutProvider =
      fromRef === 'monnify'
        ? PaymentProvider.MONNIFY
        : fromRef === 'nomba'
          ? PaymentProvider.NOMBA
          : fromRef === 'bachs'
            ? PaymentProvider.BACHS
            : fromRef === 'noah'
              ? PaymentProvider.NOAH
              : resolveRewardsWalletPaymentProvider(
                  await this.walletService.getTenantCountryCode(tenantId),
                  (await this.walletService.getWallet(tenantId)).currencyCode,
                );
    return this.walletTopupService.completeCheckoutTopup(
      {
        tenantId,
        orderReference,
        amount: body.amount,
        transactionReference: body.transactionReference?.trim() || undefined,
        initiatedByMemberId: member.id,
      },
      checkoutProvider,
    );
  }

  @Post('wallet/auto-topup')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async updateAutoTopup(
    @Param('tenantId') tenantId: string,
    @Body() body: WalletAutoTopupDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.walletService.updateAutoTopupConfig(
      tenantId,
      body.enabled,
      body.threshold,
      body.amount,
      member.id,
    );
  }

  @Post('assign-points')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async assignPoints(
    @Param('tenantId') tenantId: string,
    @Body() body: AssignMemberPointsDto,
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
    @Body() body: CreateCustomRewardDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.customRewardsService.create(tenantId, body, member.id);
  }

  @Patch('custom/:rewardId')
  @RequireFeatures(FeatureAccess.INTEGRATIONS)
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async updateCustomReward(
    @Param('tenantId') tenantId: string,
    @Param('rewardId') rewardId: string,
    @Body() body: UpdateCustomRewardDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.customRewardsService.update(tenantId, rewardId, body, member.id);
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
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.rewardsService.createTask(tenantId, body, member.id);
  }

  @Patch('tasks/:taskId')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async updateTask(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      points?: number;
      icon?: string;
      category?: string;
      imageUrl?: string;
      submissionType?: 'instant' | 'text' | 'file';
      isRecurring?: boolean;
    },
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.rewardsService.updateTask(tenantId, taskId, body, member.id);
  }

  @Delete('tasks/:taskId')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async deleteTask(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.rewardsService.deleteTask(tenantId, taskId, member.id);
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
