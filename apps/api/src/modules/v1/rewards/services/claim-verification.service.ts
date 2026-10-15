import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import type { RewardsSettings } from 'src/common/interfaces/rewards-settings.interface';
import { MonnifyBillApiService } from 'src/common/services/monnify-bill-api.service';
import { NombaBillApiService } from 'src/common/services/nomba-bill-api.service';
import { resolveNgRewardsAirtimeProvider } from 'src/common/utils/ng-money-provider.util';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { RewardRedemption, type RewardType } from '../entities/reward-redemption.entity';
import { computeRedemptionDebit } from '../utils/rewards-redemption.util';
import { RewardsCatalogService } from './rewards-catalog.service';

export interface ClaimInput {
  rewardType: RewardType;
  rewardId: string;
  rewardName?: string;
  pointsCost: number;
  currencyValue: number;
  currencyCode?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  idempotencyKey?: string;
  providerProductId?: number;
  airtimeNetwork?: 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';
  topupKind?: 'airtime' | 'data';
  dataPlanCode?: string;
  billerId?: string | number;
  accountNumber?: string;
  serviceType?: string;
}

export type ClaimCostBreakdown = {
  totalTenantDebit: number;
  expectedPointsCost: number;
  faceValueInRewardsCurrency: number;
};

@Injectable()
export class ClaimVerificationService {
  constructor(
    private readonly catalogService: RewardsCatalogService,
    private readonly nombaBillApi: NombaBillApiService,
    private readonly monnifyBillApi: MonnifyBillApiService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  private useMonnifyNgBills(): boolean {
    return resolveNgRewardsAirtimeProvider() === PaymentProvider.MONNIFY;
  }

  assertNgNombaRouting(input: ClaimInput, settings: RewardsSettings): void {
    if (input.rewardType === 'NOMBA_AIRTIME' || input.rewardType === 'NOMBA_UTILITY') {
      const configured = this.useMonnifyNgBills()
        ? this.monnifyBillApi.isConfigured()
        : this.nombaBillApi.isConfigured();
      if (!configured)
        throw new BadRequestException('Nigeria redemptions are temporarily unavailable.');
    }
  }

  async getSubscriptionFees(
    tenantId: string,
    _walletCurrency: string,
  ): Promise<{ feePercentage: number; flatFee: number }> {
    try {
      const sub = await this.subscriptionsService.getTenantSubscription(tenantId);
      return {
        feePercentage: sub?.planPrice?.regionalConfig?.rewardsFeePercentage ?? 2,
        flatFee: 0,
      };
    } catch {
      return { feePercentage: 2, flatFee: 0 };
    }
  }

  async getRedemptionFees(tenantId: string, currency: string) {
    return this.getSubscriptionFees(tenantId, currency);
  }

  async calculateLocalRewardCost(tenantId: string, amount: number) {
    const settings = await this.catalogService.getRewardsSettings(tenantId);
    const { feePercentage } = await this.getSubscriptionFees(tenantId, settings.rewardsCurrency);
    const processingFee = Number((amount * (feePercentage / 100)).toFixed(2));
    const totalTenantDebit = Number((amount + processingFee).toFixed(2));
    const pointsCost = Math.ceil(totalTenantDebit * settings.pointsExchangeRate);
    return { pointsCost, totalTenantDebit, currencyValue: amount, processingFee };
  }

  async calculatePointsCost(
    tenantId: string,
    type: string,
    _billerId: string | number | undefined,
    amount: number,
  ) {
    if (type === 'ng-airtime' || type === 'ng-utility')
      return this.calculateLocalRewardCost(tenantId, amount);
    throw new BadRequestException(`${type} rewards are not available yet`);
  }

  resolveRedemptionId(input: ClaimInput): string {
    const key = input.idempotencyKey?.trim();
    if (!key) return randomUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))
      throw new BadRequestException('idempotencyKey must be a valid UUID');
    return key;
  }

  assertMatchingIdempotentClaim(existing: RewardRedemption, input: ClaimInput): void {
    if (
      existing.rewardType !== input.rewardType ||
      existing.rewardId !== input.rewardId ||
      existing.pointsSpent !== input.pointsCost ||
      Number(existing.currencyValue) !== input.currencyValue ||
      (existing.recipient?.email ?? null) !== (input.recipientEmail ?? null) ||
      (existing.recipient?.phone ?? null) !== (input.recipientPhone ?? null)
    ) {
      throw new BadRequestException(
        'This idempotency key was already used for a different reward claim.',
      );
    }
  }

  async computeClaimCosts(
    tenantId: string,
    settings: RewardsSettings,
    input: ClaimInput,
    pointsCost: number,
    currencyValue: number,
    feePercentage: number,
  ): Promise<ClaimCostBreakdown> {
    if (input.rewardType === 'NOMBA_AIRTIME' || input.rewardType === 'NOMBA_UTILITY') {
      const calc = await this.calculateLocalRewardCost(tenantId, currencyValue);
      return {
        totalTenantDebit: calc.totalTenantDebit,
        expectedPointsCost: calc.pointsCost,
        faceValueInRewardsCurrency: calc.currencyValue,
      };
    }
    if (input.rewardType === 'TREMENDOUS') {
      const product = this.catalogService.resolveTremendousProduct(settings, input.rewardId);
      if (!product) throw new BadRequestException('Tremendous product not found in catalog');
      let wholesale = product.wholesaleInRewardsCurrency;
      if (wholesale == null) {
        if (product.listTremendousCost == null || !product.listTremendousCostCurrency)
          throw new BadRequestException('Gift card pricing unavailable. Refresh catalog.');
        wholesale = await this.catalogService.toWalletCurrency(
          product.listTremendousCost,
          product.listTremendousCostCurrency,
          settings.rewardsCurrency,
          undefined,
          product.countryCode,
        );
      }
      return {
        faceValueInRewardsCurrency: wholesale,
        totalTenantDebit: computeRedemptionDebit(wholesale, feePercentage),
        expectedPointsCost: product.pointsCost,
      };
    }
    if (input.rewardType === 'CUSTOM')
      return {
        totalTenantDebit: currencyValue,
        faceValueInRewardsCurrency: currencyValue,
        expectedPointsCost: pointsCost,
      };
    throw new BadRequestException(`Unsupported reward type: ${input.rewardType}`);
  }
}
