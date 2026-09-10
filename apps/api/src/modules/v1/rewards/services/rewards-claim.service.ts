import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { RewardsSettings } from 'src/common/interfaces/rewards-settings.interface';
import { DataSource } from 'typeorm';
import { ActivitiesService } from '../../activities/services/activities.service';
import { RewardRedemption } from '../entities/reward-redemption.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';
import { ClaimBillingService } from './claim-billing.service';
import { ClaimFulfillmentService } from './claim-fulfillment.service';
import { type ClaimInput, ClaimVerificationService } from './claim-verification.service';
import { RewardsCatalogService } from './rewards-catalog.service';
import { TenantWalletTopupService } from './tenant-wallet-topup.service';

export type { ClaimInput };

const PROCESSING_LEASE_MS = 5 * 60 * 1000;

@Injectable()
export class RewardsClaimService {
  private readonly logger = new Logger(RewardsClaimService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly verificationService: ClaimVerificationService,
    private readonly billingService: ClaimBillingService,
    private readonly fulfillmentService: ClaimFulfillmentService,
    private readonly catalogService: RewardsCatalogService,
    private readonly walletTopupService: TenantWalletTopupService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  assertNgNombaRouting(input: ClaimInput, settings: RewardsSettings): void {
    this.verificationService.assertNgNombaRouting(input, settings);
  }

  async getSubscriptionFees(
    tenantId: string,
    walletCurrency: string,
  ): Promise<{ feePercentage: number; flatFee: number }> {
    return this.verificationService.getSubscriptionFees(tenantId, walletCurrency);
  }

  async getRedemptionFees(tenantId: string, currency: string) {
    return this.verificationService.getRedemptionFees(tenantId, currency);
  }

  async calculatePointsCost(
    tenantId: string,
    type: string,
    billerId: string | number | undefined,
    amount: number,
  ) {
    return this.verificationService.calculatePointsCost(tenantId, type, billerId, amount);
  }

  async claim(tenantId: string, memberId: string, input: ClaimInput): Promise<RewardRedemption> {
    const settings = await this.catalogService.getRewardsSettings(tenantId);
    if (!settings.enabled)
      throw new BadRequestException('Rewards are not enabled for this workspace');
    this.verificationService.assertNgNombaRouting(input, settings);

    const currencyCode = input.currencyCode ?? settings.rewardsCurrency;
    const pointsCost = input.pointsCost;
    const redemptionId = this.verificationService.resolveRedemptionId(input);
    const redemptionRepo = this.dataSource.getRepository(RewardRedemption);
    const existing = await redemptionRepo.findOne({
      where: { id: redemptionId, tenantId, memberId },
    });
    if (existing) {
      this.verificationService.assertMatchingIdempotentClaim(existing, input);
      if (existing.status === 'SUCCESS' || existing.status === 'FAILED') return existing;
    }

    const { feePercentage } = await this.verificationService.getSubscriptionFees(
      tenantId,
      settings.rewardsCurrency,
    );
    const costs = await this.verificationService.computeClaimCosts(
      tenantId,
      settings,
      input,
      pointsCost,
      input.currencyValue,
      feePercentage,
    );
    if (input.rewardType !== 'CUSTOM' && pointsCost !== costs.expectedPointsCost)
      throw new BadRequestException(
        `Invalid points cost. Expected ${costs.expectedPointsCost} points for this reward.`,
      );

    if (existing?.status === 'PENDING') {
      let originalDebitAmount = costs.totalTenantDebit;
      const claimed = await this.dataSource.transaction(async (manager) => {
        const updateResult = await manager
          .getRepository(RewardRedemption)
          .createQueryBuilder()
          .update(RewardRedemption)
          .set({ status: 'PROCESSING', processingStartedAt: () => 'NOW()' })
          .where(
            'id = :id AND tenant_id = :tenantId AND member_id = :memberId AND status = :status',
            { id: redemptionId, tenantId, memberId, status: 'PENDING' },
          )
          .execute();
        if (!updateResult.affected) return null;
        const walletTxRepo = manager.getRepository(TenantWalletTransaction);
        const originalDebit = await walletTxRepo.findOne({
          where: { reference: redemptionId, type: 'SPENT' },
        });
        if (originalDebit) originalDebitAmount = Math.abs(Number(originalDebit.amount));
        return true;
      });
      if (!claimed)
        return redemptionRepo.findOneOrFail({ where: { id: redemptionId, tenantId, memberId } });
      const updated = await redemptionRepo.findOneOrFail({
        where: { id: redemptionId, tenantId, memberId },
      });
      return this.fulfillmentService.finalizeClaimFulfillment({
        tenantId,
        memberId,
        input,
        redemption: updated,
        pointsCost,
        totalTenantDebit: originalDebitAmount,
      });
    }

    if (existing?.status === 'PROCESSING') {
      const leaseExpired =
        existing.processingStartedAt &&
        Date.now() - existing.processingStartedAt.getTime() > PROCESSING_LEASE_MS;
      if (!leaseExpired)
        throw new BadRequestException('Reward claim is already being processed. Please wait.');
      this.logger.warn(`Recovering stale PROCESSING redemption ${redemptionId}`);
      await redemptionRepo.update(redemptionId, {
        status: 'PENDING',
        processingStartedAt: null,
      });
      return this.claim(tenantId, memberId, input);
    }

    await this.billingService.debitPointsAndWallet({
      tenantId,
      memberId,
      input,
      redemptionId,
      pointsCost,
      totalTenantDebit: costs.totalTenantDebit,
      currencyCode,
      costs,
    });

    const redemption = await redemptionRepo.findOneOrFail({
      where: { id: redemptionId, tenantId, memberId },
    });

    if (input.rewardType !== 'CUSTOM') {
      try {
        await this.walletTopupService.maybeAutoTopupAfterDebit(tenantId, memberId);
      } catch (e) {
        this.logger.warn(
          `Auto top-up after redemption failed: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    return this.fulfillmentService.finalizeClaimFulfillment({
      tenantId,
      memberId,
      input,
      redemption,
      pointsCost,
      totalTenantDebit: costs.totalTenantDebit,
    });
  }

  async refundStaleClaim(redemption: RewardRedemption): Promise<boolean> {
    await this.billingService.refundStaleClaim(redemption);
    void this.activitiesService
      .queueActivity({
        tenantId: redemption.tenantId,
        actorMemberId: redemption.memberId,
        action: 'reward.refunded',
        resourceType: 'reward',
        resourceId: redemption.id,
        description: `Stale claim refunded: ${redemption.rewardName ?? redemption.rewardId}`,
        metadata: { pointsCost: redemption.pointsSpent, rewardType: redemption.rewardType },
      })
      .catch(() => {});
    return true;
  }
}
