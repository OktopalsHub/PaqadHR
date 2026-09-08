import { Body, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { isNombaLive } from 'src/common/config/nomba.config';
import { CurrentTenantMember } from 'src/common/decorators';
import { RequireFeatures } from 'src/common/decorators/feature-access.decorator';
import { TenantMemberRole } from 'src/common/enums';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import {
  isRewardsWalletCheckoutLive,
  resolveRewardsWalletPaymentProvider,
} from '../config/rewards-wallet-provider.config';
import { WalletAutoTopupDto } from '../dto/wallet-auto-topup.dto';
import { WalletTopupCompleteDto, WalletTopupDto } from '../dto/wallet-topup.dto';
import { RewardsService } from '../services/rewards.service';
import { TenantWalletService } from '../services/tenant-wallet.service';
import { TenantWalletTopupService } from '../services/tenant-wallet-topup.service';
import { resolveWalletTopupProviderFromOrderRef } from '../utils/wallet-order-ref.util';

const _ALL_ROLES = [
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
    savedCardTopupSupported:
      checkoutProvider !== PaymentProvider.BACHS && checkoutProvider !== PaymentProvider.FINCRA,
    /** @deprecated use checkoutLive */
    nombaLive: isNombaLive(),
  };
}

export class RewardsWalletHandler {
  constructor(
    private readonly rewardsService: RewardsService,
    private readonly walletService: TenantWalletService,
    private readonly walletTopupService: TenantWalletTopupService,
  ) {}

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
      fromRef ??
      resolveRewardsWalletPaymentProvider(
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
}
