import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { formatNombaSenderName } from 'src/common/config/nomba.config';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { ShoutoutPointTransactionType } from 'src/common/enums/shoutout-point-transaction-type.enum';
import type { RewardsSettings } from 'src/common/interfaces/rewards-settings.interface';
import { ProductAnalyticsService } from 'src/common/observability/product-analytics.service';
import { MonnifyBillApiService } from 'src/common/services/monnify-bill-api.service';
import { NombaBillApiService } from 'src/common/services/nomba-bill-api.service';
import { TremendousApiService } from 'src/common/services/tremendous-api.service';
import { resolveNgRewardsAirtimeProvider } from 'src/common/utils/ng-money-provider.util';
import { DataSource } from 'typeorm';
import { ActivitiesService } from '../../activities/services/activities.service';
import { EmailTemplateService } from '../../notifications/services/email-template.service';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';
import { ShoutoutMemberPoints } from '../../shoutouts/entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from '../../shoutouts/entities/shoutout-point-transaction.entity';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { CustomReward } from '../entities/custom-reward.entity';
import {
  type RedemptionStatus,
  RewardRedemption,
  type RewardType,
} from '../entities/reward-redemption.entity';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';
import { computeRedemptionDebit } from '../utils/rewards-redemption.util';
import { CustomRewardsService } from './custom-rewards.service';
import { RewardsCatalogService } from './rewards-catalog.service';
import { TenantWalletService } from './tenant-wallet.service';
import { TenantWalletTopupService } from './tenant-wallet-topup.service';

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

const PROCESSING_LEASE_MS = 5 * 60 * 1000;

type ClaimCostBreakdown = {
  totalTenantDebit: number;
  expectedPointsCost: number;
  faceValueInRewardsCurrency: number;
};

@Injectable()
export class RewardsClaimService {
  private readonly logger = new Logger(RewardsClaimService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly walletService: TenantWalletService,
    private readonly walletTopupService: TenantWalletTopupService,
    readonly _customRewardsService: CustomRewardsService,
    private readonly catalogService: RewardsCatalogService,
    private readonly nombaBillApi: NombaBillApiService,
    private readonly monnifyBillApi: MonnifyBillApiService,
    private readonly tremendousApi: TremendousApiService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly activitiesService: ActivitiesService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly emailService: ZeptomailEmailService,
    private readonly notificationHelper: NotificationHelperService,
    private readonly productAnalytics: ProductAnalyticsService,
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

  private async calculateLocalRewardCost(tenantId: string, amount: number) {
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

  private resolveRedemptionId(input: ClaimInput): string {
    const key = input.idempotencyKey?.trim();
    if (!key) return randomUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))
      throw new BadRequestException('idempotencyKey must be a valid UUID');
    return key;
  }

  private assertMatchingIdempotentClaim(existing: RewardRedemption, input: ClaimInput): void {
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

  private async computeClaimCosts(
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

  async claim(tenantId: string, memberId: string, input: ClaimInput): Promise<RewardRedemption> {
    const settings = await this.catalogService.getRewardsSettings(tenantId);
    if (!settings.enabled)
      throw new BadRequestException('Rewards are not enabled for this workspace');
    this.assertNgNombaRouting(input, settings);

    const currencyCode = input.currencyCode ?? settings.rewardsCurrency;
    const pointsCost = input.pointsCost;
    const redemptionId = this.resolveRedemptionId(input);
    const redemptionRepo = this.dataSource.getRepository(RewardRedemption);
    const existing = await redemptionRepo.findOne({
      where: { id: redemptionId, tenantId, memberId },
    });
    if (existing) {
      this.assertMatchingIdempotentClaim(existing, input);
      if (existing.status === 'SUCCESS' || existing.status === 'FAILED') return existing;
    }

    const { feePercentage } = await this.getSubscriptionFees(tenantId, settings.rewardsCurrency);
    const costs = await this.computeClaimCosts(
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
          .set({ status: 'PROCESSING' as RedemptionStatus, processingStartedAt: () => 'NOW()' })
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
      return this.finalizeClaimFulfillment({
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
        status: 'PENDING' as RedemptionStatus,
        processingStartedAt: null,
      });
      return this.claim(tenantId, memberId, input);
    }

    let redemption: RewardRedemption;
    await this.dataSource.transaction(async (manager) => {
      if (
        await manager
          .getRepository(RewardRedemption)
          .findOne({ where: { id: redemptionId, tenantId, memberId } })
      )
        throw new BadRequestException('Reward claim is already being processed. Please wait.');
      if (input.rewardType === 'CUSTOM') {
        const cr = await manager
          .getRepository(CustomReward)
          .findOneOrFail({ where: { id: input.rewardId, tenantId } });
        if (!cr.isActive) throw new BadRequestException('This custom reward is currently inactive');
        if (pointsCost !== cr.pointsCost)
          throw new BadRequestException(`Invalid points cost for custom reward: ${cr.pointsCost}`);
        if (cr.stockLimit !== null) {
          if (cr.stockLimit <= 0) throw new BadRequestException('Reward is out of stock');
          await manager
            .getRepository(CustomReward)
            .update(cr.id, { stockLimit: cr.stockLimit - 1 });
        }
      }
      const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
      const memberPoints = await pointsRepo.findOne({ where: { tenantId, memberId } });
      if (!memberPoints || memberPoints.currentBalance < pointsCost)
        throw new BadRequestException(
          `Insufficient points. You need ${pointsCost} points but have ${memberPoints?.currentBalance ?? 0}.`,
        );
      const updateResult = await pointsRepo
        .createQueryBuilder()
        .update(ShoutoutMemberPoints)
        .set({ currentBalance: () => 'current_balance - :pointsCost' })
        .where(
          'tenant_id = :tenantId AND member_id = :memberId AND current_balance >= :pointsCost',
          { tenantId, memberId, pointsCost },
        )
        .execute();
      if (!updateResult.affected)
        throw new BadRequestException('Insufficient points or transaction conflict.');
      const txRepo = manager.getRepository(ShoutoutPointTransaction);
      const updatedPoints = await pointsRepo.findOneOrFail({ where: { tenantId, memberId } });
      await txRepo.save(
        txRepo.create({
          tenantId,
          memberId,
          type: ShoutoutPointTransactionType.REDEMPTION,
          points: -pointsCost,
          runningBalance: updatedPoints.currentBalance,
          description: `Redeemed for: ${input.rewardName ?? input.rewardId}`,
          createdBy: memberId,
        }),
      );
      if (input.rewardType !== 'CUSTOM')
        await this.walletService.debit(
          tenantId,
          costs.totalTenantDebit,
          redemptionId,
          `Reward claim: ${input.rewardName ?? input.rewardId} (Face Value: ${currencyCode} ${input.currencyValue}, Platform Fees: ${Number((costs.totalTenantDebit - costs.faceValueInRewardsCurrency).toFixed(2))})`,
          memberId,
          manager,
        );
      redemption = manager.getRepository(RewardRedemption).create({
        id: redemptionId,
        tenantId,
        memberId,
        rewardType: input.rewardType,
        rewardId: input.rewardId,
        rewardName: input.rewardName,
        pointsSpent: pointsCost,
        currencyValue: input.currencyValue,
        currencyCode,
        status: 'PENDING' as RedemptionStatus,
        recipient: {
          email: input.recipientEmail ?? undefined,
          phone: input.recipientPhone ?? undefined,
        },
      });
      await manager.getRepository(RewardRedemption).save(redemption);
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
    return this.finalizeClaimFulfillment({
      tenantId,
      memberId,
      input,
      redemption: redemption!,
      pointsCost,
      totalTenantDebit: costs.totalTenantDebit,
    });
  }

  private async finalizeClaimFulfillment(params: {
    tenantId: string;
    memberId: string;
    input: ClaimInput;
    redemption: RewardRedemption;
    pointsCost: number;
    totalTenantDebit: number;
  }): Promise<RewardRedemption> {
    const { tenantId, memberId, input, pointsCost, totalTenantDebit } = params;
    let redemption = params.redemption;
    const redemptionId = redemption.id;

    try {
      await this.runClaimFulfillment(redemption, input);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown fulfillment error';
      this.logger.error(`Reward fulfillment failed for ${redemptionId}: ${errorMessage}`);
      const alreadyFailed = await this.dataSource
        .getRepository(RewardRedemption)
        .findOne({ where: { id: redemptionId, status: 'FAILED' as RedemptionStatus } });
      if (alreadyFailed) return alreadyFailed;

      let originalDebitAmount = totalTenantDebit;
      const originalDebit = await this.dataSource
        .getRepository(TenantWalletTransaction)
        .findOne({ where: { reference: redemptionId, type: 'SPENT' } });
      if (originalDebit) originalDebitAmount = Math.abs(Number(originalDebit.amount));

      await this.dataSource.transaction(async (manager) => {
        const flip = await manager
          .getRepository(RewardRedemption)
          .createQueryBuilder()
          .update(RewardRedemption)
          .set({
            status: 'FAILED' as RedemptionStatus,
            providerRef: { ...redemption.providerRef, error: errorMessage },
            processingStartedAt: null,
          })
          .where(
            'id = :redemptionId AND tenant_id = :tenantId AND member_id = :memberId AND status <> :failed',
            { redemptionId, tenantId, memberId, failed: 'FAILED' as RedemptionStatus },
          )
          .execute();
        if (!flip.affected) return;
        const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
        await pointsRepo
          .createQueryBuilder()
          .update(ShoutoutMemberPoints)
          .set({ currentBalance: () => 'current_balance + :pointsCost' })
          .where('tenant_id = :tenantId AND member_id = :memberId', {
            tenantId,
            memberId,
            pointsCost,
          })
          .execute();
        const txRepo = manager.getRepository(ShoutoutPointTransaction);
        const updatedPoints = await pointsRepo.findOne({ where: { tenantId, memberId } });
        if (updatedPoints)
          await txRepo.save(
            txRepo.create({
              tenantId,
              memberId,
              type: ShoutoutPointTransactionType.REDEMPTION,
              points: pointsCost,
              runningBalance: updatedPoints.currentBalance,
              description: `Refund: ${input.rewardName ?? input.rewardId} — ${errorMessage}`,
              createdBy: memberId,
            }),
          );

        if (input.rewardType !== 'CUSTOM') {
          const wallet = await manager
            .getRepository(TenantWallet)
            .createQueryBuilder('w')
            .setLock('pessimistic_write')
            .where('w.tenant_id = :tenantId', { tenantId })
            .getOne();
          if (wallet) {
            const existingRefund = await manager
              .getRepository(TenantWalletTransaction)
              .findOne({ where: { reference: `refund:${redemptionId}`, type: 'REFUND' } });
            if (!existingRefund) {
              await manager
                .getRepository(TenantWallet)
                .createQueryBuilder()
                .update(TenantWallet)
                .set({ balanceAmount: () => 'balance_amount + :amount' })
                .where('tenant_id = :tenantId', { tenantId, amount: originalDebitAmount })
                .execute();
              await manager.getRepository(TenantWalletTransaction).save(
                manager.getRepository(TenantWalletTransaction).create({
                  tenantWalletId: wallet.id,
                  type: 'REFUND',
                  amount: originalDebitAmount,
                  reference: `refund:${redemptionId}`,
                  description: `Refund: ${input.rewardName ?? input.rewardId}`,
                  status: 'COMPLETED',
                  rawAmount: originalDebitAmount,
                  metadata: { actorMemberId: memberId },
                }),
              );
            }
          }
        }
        if (input.rewardType === 'CUSTOM') {
          const cr = await manager
            .getRepository(CustomReward)
            .findOne({ where: { id: input.rewardId, tenantId } });
          if (cr && cr.stockLimit !== null)
            await manager
              .getRepository(CustomReward)
              .update(cr.id, { stockLimit: cr.stockLimit + 1 });
        }
      });
      redemption = await this.dataSource
        .getRepository(RewardRedemption)
        .findOneOrFail({ where: { id: redemptionId, tenantId, memberId } });
      return redemption;
    }

    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: memberId,
        action: 'reward.redeemed',
        resourceType: 'reward',
        resourceId: redemptionId,
        description: `${input.rewardName ?? input.rewardId} redeemed`,
        metadata: {
          rewardName: input.rewardName ?? input.rewardId,
          pointsCost,
          rewardType: input.rewardType,
        },
      })
      .catch((err) =>
        this.logger.warn(`Failed to queue activity: ${err instanceof Error ? err.message : err}`),
      );
    this.productAnalytics.capture(memberId, 'reward_redeemed', { tenantId });
    void this.notificationHelper
      .sendRewardRedemptionNotification(memberId, tenantId, {
        rewardName: input.rewardName ?? input.rewardId,
        status: 'processing',
      })
      .catch((err) =>
        this.logger.warn(
          `Failed to send notification: ${err instanceof Error ? err.message : err}`,
        ),
      );
    return this.dataSource
      .getRepository(RewardRedemption)
      .findOneOrFail({ where: { id: redemptionId, tenantId, memberId } });
  }

  private async runClaimFulfillment(
    redemption: RewardRedemption,
    input: ClaimInput,
  ): Promise<void> {
    if (input.rewardType === 'TREMENDOUS') return this.fulfillTremendous(redemption, input);
    if (input.rewardType === 'NOMBA_AIRTIME') return this.fulfillNombaTopup(redemption, input);
    if (input.rewardType === 'NOMBA_UTILITY') return this.fulfillNombaUtility(redemption, input);
    if (input.rewardType === 'CUSTOM') return this.fulfillCustom(redemption);
  }

  private async fulfillTremendous(redemption: RewardRedemption, input: ClaimInput): Promise<void> {
    const productId = this.catalogService.extractTremendousProductId(input.rewardId);
    if (!productId) throw new Error('Missing Tremendous productId for gift card order');
    const member = await this.dataSource
      .getRepository(TenantMember)
      .createQueryBuilder('m')
      .leftJoin('m.user', 'u')
      .select(['m.id', 'm.firstName', 'm.lastName', 'm.preferredName', 'u.id', 'u.email'])
      .where('m.id = :id AND m.tenantId = :tenantId', {
        id: redemption.memberId,
        tenantId: redemption.tenantId,
      })
      .getOne();
    const recipientEmail = redemption.recipient?.email ?? member?.user?.email;
    if (!recipientEmail)
      throw new Error('Recipient email is required to issue a Tremendous reward');
    const recipientName =
      member?.preferredName?.trim() ||
      `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() ||
      'Member';
    const orderResponse = await this.tremendousApi.createOrder({
      productId,
      denomination: Number(redemption.currencyValue),
      currencyCode: redemption.currencyCode,
      recipientName,
      recipientEmail,
      externalId: redemption.id,
    });
    const orderStatus = orderResponse.order?.status;
    const reward = orderResponse.reward ?? orderResponse.order?.rewards?.[0];
    const deliveryStatus = reward?.delivery?.status;
    const deliveryLink = reward?.delivery?.link ?? null;
    const orderId = orderResponse.order?.id ?? reward?.id ?? null;
    if (
      orderStatus === 'DECLINED' ||
      orderStatus === 'CANCELLED' ||
      deliveryStatus === 'FAILED' ||
      deliveryStatus === 'BOUNCED'
    )
      throw new Error(
        `Tremendous order was not fulfilled: ${orderStatus ?? deliveryStatus ?? 'unknown status'}`,
      );
    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      providerRef: { ...redemption.providerRef, txRef: orderId ?? undefined },
      voucher: {
        code: deliveryLink ?? undefined,
        instructions: deliveryLink
          ? 'Open this link to choose and redeem your gift card.'
          : 'Your reward is being prepared. Check back shortly for your redemption link.',
      },
      processingStartedAt: null,
    });
    if (deliveryLink)
      void this.sendRewardClaimEmail({
        recipientEmail,
        recipientName,
        redemption,
        deliveryLink,
      }).catch((err) =>
        this.logger.warn(
          `Failed to send reward claim email: ${err instanceof Error ? err.message : err}`,
        ),
      );
  }

  private async sendRewardClaimEmail(params: {
    recipientEmail: string;
    recipientName: string;
    redemption: RewardRedemption;
    deliveryLink: string;
  }): Promise<void> {
    const rendered = this.emailTemplateService.render('reward-claim', {
      employeeName: params.recipientName,
      employeeEmail: params.recipientEmail,
      rewardName: params.redemption.rewardName ?? 'Gift Card',
      rewardAmount: params.redemption.currencyValue,
      currencyCode: params.redemption.currencyCode,
      redemptionUrl: params.deliveryLink,
      referenceId: params.redemption.id,
      providerName: 'Tremendous',
      providerLogoUrl: 'https://www.tremendous.com/img/tremendous-logo.png',
    });
    await this.emailService.sendEmail({
      to: params.recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  private async fulfillNombaTopup(redemption: RewardRedemption, input: ClaimInput): Promise<void> {
    if (!input.recipientPhone || !input.airtimeNetwork)
      throw new Error('Phone number and network are required for mobile top-up');
    const isData = input.topupKind === 'data';
    let result: { success: boolean; transactionId: string | null; status: string };
    if (this.useMonnifyNgBills()) {
      result = isData
        ? await this.monnifyBillApi.purchaseDataBundle({
            amount: redemption.currencyValue,
            phoneNumber: input.recipientPhone,
            network: input.airtimeNetwork,
            merchantTxRef: redemption.id,
            dataPlanCode: input.dataPlanCode,
          })
        : await this.monnifyBillApi.purchaseAirtime({
            amount: redemption.currencyValue,
            phoneNumber: input.recipientPhone,
            network: input.airtimeNetwork,
            merchantTxRef: redemption.id,
          });
    } else {
      const tenant = await this.dataSource
        .getRepository(Tenant)
        .findOne({ where: { id: redemption.tenantId }, select: { name: true } });
      result = isData
        ? await this.nombaBillApi.purchaseDataBundle({
            amount: redemption.currencyValue,
            phoneNumber: input.recipientPhone,
            network: input.airtimeNetwork,
            merchantTxRef: redemption.id,
            senderName: formatNombaSenderName(tenant?.name),
          })
        : await this.nombaBillApi.purchaseAirtime({
            amount: redemption.currencyValue,
            phoneNumber: input.recipientPhone,
            network: input.airtimeNetwork,
            merchantTxRef: redemption.id,
            senderName: formatNombaSenderName(tenant?.name),
          });
    }
    if (result.success) {
      await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
        status: 'SUCCESS' as RedemptionStatus,
        providerRef: { ...redemption.providerRef, txRef: result.transactionId ?? undefined },
        voucher: {
          instructions: isData
            ? `Data bundle of ${redemption.currencyCode} ${redemption.currencyValue} sent to ${input.recipientPhone}`
            : `Airtime of ${redemption.currencyCode} ${redemption.currencyValue} sent to ${input.recipientPhone}`,
        },
        processingStartedAt: null,
      });
      return;
    }
    if (result.status !== 'PENDING')
      throw new Error(
        `${isData ? 'Data bundle' : 'Airtime'} purchase failed: status ${result.status}`,
      );
    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'PROCESSING' as RedemptionStatus,
      providerRef: { ...redemption.providerRef, txRef: result.transactionId ?? undefined },
      voucher: {
        instructions: `Your ${isData ? 'data bundle' : 'airtime'} is being confirmed with the network.`,
      },
      processingStartedAt: () => 'NOW()',
    });
  }

  private async fulfillNombaUtility(
    redemption: RewardRedemption,
    input: ClaimInput,
  ): Promise<void> {
    if (!input.accountNumber || !input.billerId || !input.serviceType)
      throw new Error('Meter number, biller ID, and service type are required');
    const purchaseInput = {
      amount: redemption.currencyValue,
      meterNumber: input.accountNumber,
      billerId: String(input.billerId),
      serviceType: input.serviceType as 'PREPAID' | 'POSTPAID',
      merchantTxRef: redemption.id,
    };
    const result = this.useMonnifyNgBills()
      ? await this.monnifyBillApi.purchaseElectricity(purchaseInput)
      : await this.nombaBillApi.purchaseElectricity(purchaseInput);
    if (result.success) {
      await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
        status: 'SUCCESS' as RedemptionStatus,
        providerRef: { ...redemption.providerRef, txRef: result.transactionId ?? undefined },
        voucher: {
          code: result.token || undefined,
          instructions: result.token
            ? `Utility payment successful. Prepaid token: ${result.token}`
            : `Utility payment successful. Reference: ${result.transactionId}`,
        },
        processingStartedAt: null,
      });
      return;
    }
    if (result.status !== 'PENDING')
      throw new Error(`Electricity purchase failed: status ${result.status}`);
    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'PROCESSING' as RedemptionStatus,
      providerRef: { ...redemption.providerRef, txRef: result.transactionId ?? undefined },
      voucher: { instructions: 'Your utility payment is being confirmed with the provider.' },
      processingStartedAt: () => 'NOW()',
    });
  }

  private async fulfillCustom(redemption: RewardRedemption): Promise<void> {
    const customReward = await this.dataSource
      .getRepository(CustomReward)
      .findOne({ where: { id: redemption.rewardId ?? undefined } });
    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      voucher: {
        instructions:
          customReward?.deliveryInstructions ??
          'Your admin has been notified and will fulfill this reward.',
      },
      processingStartedAt: null,
    });
  }

  async refundStaleClaim(redemption: RewardRedemption): Promise<boolean> {
    const {
      tenantId,
      memberId,
      id: redemptionId,
      pointsSpent: pointsCost,
      rewardType,
    } = redemption;
    const originalDebit = await this.dataSource
      .getRepository(TenantWalletTransaction)
      .findOne({ where: { reference: redemptionId, type: 'SPENT' } });
    const originalDebitAmount = originalDebit ? Math.abs(Number(originalDebit.amount)) : 0;

    await this.dataSource.transaction(async (manager) => {
      const flip = await manager
        .getRepository(RewardRedemption)
        .createQueryBuilder()
        .update(RewardRedemption)
        .set({
          status: 'FAILED' as RedemptionStatus,
          providerRef: { ...redemption.providerRef, error: 'Stale processing lease expired' },
          processingStartedAt: null,
        })
        .where(
          'id = :redemptionId AND tenant_id = :tenantId AND member_id = :memberId AND status = :status',
          { redemptionId, tenantId, memberId, status: 'PROCESSING' },
        )
        .execute();
      if (!flip.affected) return;
      const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
      await pointsRepo
        .createQueryBuilder()
        .update(ShoutoutMemberPoints)
        .set({ currentBalance: () => 'current_balance + :pointsCost' })
        .where('tenant_id = :tenantId AND member_id = :memberId', {
          tenantId,
          memberId,
          pointsCost,
        })
        .execute();
      const updatedPoints = await pointsRepo.findOne({ where: { tenantId, memberId } });
      if (updatedPoints)
        await manager.getRepository(ShoutoutPointTransaction).save(
          manager.getRepository(ShoutoutPointTransaction).create({
            tenantId,
            memberId,
            type: ShoutoutPointTransactionType.REDEMPTION,
            points: pointsCost,
            runningBalance: updatedPoints.currentBalance,
            description: `Refund: stale claim ${redemptionId}`,
            createdBy: memberId,
          }),
        );
      if (rewardType !== 'CUSTOM') {
        const wallet = await manager
          .getRepository(TenantWallet)
          .createQueryBuilder('w')
          .setLock('pessimistic_write')
          .where('w.tenant_id = :tenantId', { tenantId })
          .getOne();
        if (
          wallet &&
          !(await manager
            .getRepository(TenantWalletTransaction)
            .findOne({ where: { reference: `refund:${redemptionId}`, type: 'REFUND' } }))
        ) {
          await manager
            .getRepository(TenantWallet)
            .createQueryBuilder()
            .update(TenantWallet)
            .set({ balanceAmount: () => 'balance_amount + :amount' })
            .where('tenant_id = :tenantId', { tenantId, amount: originalDebitAmount })
            .execute();
          await manager.getRepository(TenantWalletTransaction).save(
            manager.getRepository(TenantWalletTransaction).create({
              tenantWalletId: wallet.id,
              type: 'REFUND',
              amount: originalDebitAmount,
              reference: `refund:${redemptionId}`,
              description: 'Refund: stale claim',
              status: 'COMPLETED',
              rawAmount: originalDebitAmount,
              metadata: { actorMemberId: memberId },
            }),
          );
        }
      }
      if (rewardType === 'CUSTOM') {
        const cr = await manager
          .getRepository(CustomReward)
          .findOne({ where: { id: redemption.rewardId ?? undefined, tenantId } });
        if (cr?.stockLimit != null)
          await manager
            .getRepository(CustomReward)
            .update(cr.id, { stockLimit: cr.stockLimit + 1 });
      }
    });
    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: memberId,
        action: 'reward.refunded',
        resourceType: 'reward',
        resourceId: redemptionId,
        description: `Stale claim refunded: ${redemption.rewardName ?? redemption.rewardId}`,
        metadata: { pointsCost, rewardType },
      })
      .catch(() => {});
    return true;
  }
}
