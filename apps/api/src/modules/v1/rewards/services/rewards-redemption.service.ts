import { randomUUID } from 'node:crypto';
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { formatNombaSenderName } from 'src/common/config/nomba.config';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { RewardRedemption, type RedemptionStatus } from '../entities/reward-redemption.entity';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { CustomReward } from '../entities/custom-reward.entity';
import { ShoutoutMemberPoints } from '../../shoutouts/entities/shoutout-member-points.entity';
import { TenantWalletService } from './tenant-wallet.service';
import { TenantWalletTopupService } from './tenant-wallet-topup.service';
import { RewardsPointsService } from './rewards-points.service';
import { RewardsProviderService } from './rewards-provider.service';
import { computeRedemptionDebit } from '../utils/rewards-redemption.util';
import type { ClaimInput } from '../interfaces/rewards.interface';
import type { RewardsSettings } from 'src/common/interfaces/rewards-settings.interface';
import { MonnifyBillApiService } from 'src/common/services/monnify-bill-api.service';
import { NombaBillApiService } from 'src/common/services/nomba-bill-api.service';
import { TremendousApiService } from 'src/common/services/tremendous-api.service';
import { ActivitiesService } from '../../activities/services/activities.service';
import { EmailTemplateService } from '../../notifications/services/email-template.service';
import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROCESSING_LEASE_MS = 5 * 60 * 1000;

type ClaimCostBreakdown = {
  totalTenantDebit: number;
  expectedPointsCost: number;
  faceValueInRewardsCurrency: number;
};

@Injectable()
export class RewardsRedemptionService {
  private readonly logger = new Logger(RewardsRedemptionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly walletService: TenantWalletService,
    private readonly walletTopupService: TenantWalletTopupService,
    private readonly pointsService: RewardsPointsService,
    private readonly providerService: RewardsProviderService,
    private readonly nombaBillApi: NombaBillApiService,
    private readonly monnifyBillApi: MonnifyBillApiService,
    private readonly tremendousApi: TremendousApiService,
    private readonly activitiesService: ActivitiesService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly emailService: ZeptomailEmailService,
  ) {}

  private resolveRedemptionId(input: ClaimInput): string {
    const key = input.idempotencyKey?.trim();
    if (!key) {
      return randomUUID();
    }
    if (!UUID_PATTERN.test(key)) {
      throw new BadRequestException('idempotencyKey must be a valid UUID');
    }
    return key;
  }

  private assertMatchingIdempotentClaim(existing: RewardRedemption, input: ClaimInput): void {
    const existingEmail = existing.recipient?.email ?? null;
    const existingPhone = existing.recipient?.phone ?? null;
    if (
      existing.rewardType !== input.rewardType ||
      existing.rewardId !== input.rewardId ||
      existing.pointsSpent !== input.pointsCost ||
      Number(existing.currencyValue) !== input.currencyValue ||
      existingEmail !== (input.recipientEmail ?? null) ||
      existingPhone !== (input.recipientPhone ?? null)
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
    pointsExchangeRate: number,
  ): Promise<ClaimCostBreakdown> {
    if (input.rewardType === 'NOMBA_AIRTIME' || input.rewardType === 'NOMBA_UTILITY') {
      const calc = await this.pointsService.calculateLocalRewardCost(
        tenantId,
        currencyValue,
        pointsExchangeRate,
      );
      return {
        totalTenantDebit: calc.totalTenantDebit,
        expectedPointsCost: calc.pointsCost,
        faceValueInRewardsCurrency: calc.currencyValue,
      };
    }

    if (input.rewardType === 'TREMENDOUS') {
      const product = this.resolveTremendousProduct(settings, input.rewardId);
      if (!product) {
        throw new BadRequestException('Tremendous product not found in catalog');
      }

      let wholesaleInRewardsCurrency = product.wholesaleInRewardsCurrency;
      if (wholesaleInRewardsCurrency == null) {
        if (product.listTremendousCost == null || !product.listTremendousCostCurrency) {
          throw new BadRequestException(
            'Gift card pricing is not available. Please refresh the rewards catalog.',
          );
        }
        wholesaleInRewardsCurrency = await this.toWalletCurrency(
          product.listTremendousCost,
          product.listTremendousCostCurrency,
          settings.rewardsCurrency,
          undefined,
          product.countryCode,
        );
      }

      return {
        faceValueInRewardsCurrency: wholesaleInRewardsCurrency,
        totalTenantDebit: computeRedemptionDebit(wholesaleInRewardsCurrency, feePercentage),
        expectedPointsCost: product.pointsCost,
      };
    }

    if (input.rewardType === 'CUSTOM') {
      return {
        totalTenantDebit: currencyValue,
        faceValueInRewardsCurrency: currencyValue,
        expectedPointsCost: pointsCost,
      };
    }

    throw new BadRequestException(`Unsupported reward type: ${input.rewardType}`);
  }

  private resolveTremendousProduct(
    settings: RewardsSettings,
    rewardId: string,
  ): NonNullable<RewardsSettings['tremendousProducts']>[number] | undefined {
    if (!rewardId.startsWith('tremendous_')) return undefined;
    const rest = rewardId.slice('tremendous_'.length);
    const withCountry = rest.match(/^([A-Z]{2})_(.+)$/);
    if (withCountry) {
      const countryCode = withCountry[1];
      const productId = withCountry[2];
      return settings.tremendousProducts?.find(
        (p) => p.productId === productId && p.countryCode === countryCode,
      );
    }
    if (!rest) return undefined;
    return settings.tremendousProducts?.find((p) => p.productId === rest);
  }

  private async toWalletCurrency(
    localAmount: number,
    localCurrency: string,
    walletCurrency: string,
    operatorId?: number,
    countryCode?: string,
  ): Promise<number> {
    const fiatExchange = this.dataSource.getRepository(TenantSettings);
    return localAmount;
  }

  private async resolveSenderName(tenantId: string): Promise<string> {
    const tenant = await this.dataSource.getRepository(Tenant).findOne({
      where: { id: tenantId },
      select: { name: true },
    });
    return formatNombaSenderName(tenant?.name);
  }

  async claim(
    tenantId: string,
    memberId: string,
    input: ClaimInput,
    settings: RewardsSettings,
  ): Promise<RewardRedemption> {
    const currencyCode = input.currencyCode ?? settings.rewardsCurrency;
    const currencyValue = input.currencyValue;
    const pointsCost = input.pointsCost;
    const redemptionId = this.resolveRedemptionId(input);
    const redemptionRepo = this.dataSource.getRepository(RewardRedemption);
    const existing = await redemptionRepo.findOne({
      where: { id: redemptionId, tenantId, memberId },
    });

    if (existing) {
      this.assertMatchingIdempotentClaim(existing, input);
      if (existing.status === 'SUCCESS' || existing.status === 'FAILED') {
        return existing;
      }
    }

    const { feePercentage } = await this.getSubscriptionFees(tenantId, settings.rewardsCurrency);
    const costs = await this.computeClaimCosts(
      tenantId,
      settings,
      input,
      pointsCost,
      currencyValue,
      feePercentage,
      settings.pointsExchangeRate,
    );

    if (input.rewardType !== 'CUSTOM' && pointsCost !== costs.expectedPointsCost) {
      throw new BadRequestException(
        `Invalid points cost. Expected ${costs.expectedPointsCost} points for this reward.`,
      );
    }

    if (existing?.status === 'PENDING') {
      let originalDebitAmount = costs.totalTenantDebit;

      const claimed = await this.dataSource.transaction(async (manager) => {
        const updateResult = await manager
          .getRepository(RewardRedemption)
          .createQueryBuilder()
          .update(RewardRedemption)
          .set({
            status: 'PROCESSING' as RedemptionStatus,
            processingStartedAt: () => 'NOW()',
          })
          .where(
            'id = :id AND tenant_id = :tenantId AND member_id = :memberId AND status = :status',
            {
              id: redemptionId,
              tenantId,
              memberId,
              status: 'PENDING',
            },
          )
          .execute();

        if (!updateResult.affected) {
          return null;
        }

        const walletTxRepo = manager.getRepository(TenantWalletTransaction);
        const originalDebit = await walletTxRepo.findOne({
          where: { reference: redemptionId, type: 'SPENT' },
        });
        if (originalDebit) {
          originalDebitAmount = Math.abs(Number(originalDebit.amount));
        }

        return true;
      });

      if (!claimed) {
        return this.dataSource.getRepository(RewardRedemption).findOneOrFail({
          where: { id: redemptionId, tenantId, memberId },
        });
      }

      const updated = await this.dataSource.getRepository(RewardRedemption).findOneOrFail({
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

      if (!leaseExpired) {
        throw new BadRequestException('Reward claim is already being processed. Please wait.');
      }

      this.logger.warn(
        `Recovering stale PROCESSING redemption ${redemptionId} (lease expired at ${existing.processingStartedAt?.toISOString()})`,
      );

      await this.dataSource.getRepository(RewardRedemption).update(redemptionId, {
        status: 'PENDING' as RedemptionStatus,
        processingStartedAt: null,
      });

      return this.claim(tenantId, memberId, input, settings);
    }

    let redemption: RewardRedemption;
    await this.dataSource.transaction(async (manager) => {
      const pending = await manager.getRepository(RewardRedemption).findOne({
        where: { id: redemptionId, tenantId, memberId },
      });
      if (pending) {
        throw new BadRequestException('Reward claim is already being processed. Please wait.');
      }

      if (input.rewardType === 'CUSTOM') {
        const customRewardRepo = manager.getRepository(CustomReward);
        const cr = await customRewardRepo.findOneOrFail({
          where: { id: input.rewardId, tenantId },
        });
        if (!cr.isActive) {
          throw new BadRequestException('This custom reward is currently inactive');
        }
        if (pointsCost !== cr.pointsCost) {
          throw new BadRequestException(`Invalid points cost for custom reward: ${cr.pointsCost}`);
        }
        if (cr.stockLimit !== null) {
          if (cr.stockLimit <= 0) {
            throw new BadRequestException('Reward is out of stock');
          }
          await customRewardRepo.update(cr.id, {
            stockLimit: cr.stockLimit - 1,
          });
        }
      }

      const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
      const memberPoints = await pointsRepo.findOne({ where: { tenantId, memberId } });
      if (!memberPoints || memberPoints.currentBalance < pointsCost) {
        throw new BadRequestException(
          `Insufficient points. You need ${pointsCost} points but have ${memberPoints?.currentBalance ?? 0}.`,
        );
      }

      const updateResult = await pointsRepo
        .createQueryBuilder()
        .update(ShoutoutMemberPoints)
        .set({ currentBalance: () => 'current_balance - :pointsCost' })
        .where(
          'tenant_id = :tenantId AND member_id = :memberId AND current_balance >= :pointsCost',
          {
            tenantId,
            memberId,
            pointsCost,
          },
        )
        .execute();

      if (!updateResult.affected) {
        throw new BadRequestException('Insufficient points or transaction conflict.');
      }

      if (input.rewardType !== 'CUSTOM') {
        await this.walletService.debit(
          tenantId,
          costs.totalTenantDebit,
          redemptionId,
          `Reward claim: ${input.rewardName ?? input.rewardId}`,
          memberId,
          manager,
        );
      }

      const txRedemptionRepo = manager.getRepository(RewardRedemption);
      redemption = txRedemptionRepo.create({
        id: redemptionId,
        tenantId,
        memberId,
        rewardType: input.rewardType,
        rewardId: input.rewardId,
        rewardName: input.rewardName,
        pointsSpent: pointsCost,
        currencyValue,
        currencyCode,
        status: 'PENDING' as RedemptionStatus,
        recipient: {
          email: input.recipientEmail ?? undefined,
          phone: input.recipientPhone ?? undefined,
        },
      });
      await txRedemptionRepo.save(redemption);
    });

    if (input.rewardType !== 'CUSTOM') {
      try {
        await this.walletTopupService.maybeAutoTopupAfterDebit(tenantId, memberId);
      } catch (error) {
        this.logger.warn(
          `Auto top-up after redemption failed for tenant ${tenantId}: ${error instanceof Error ? error.message : error}`,
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

      const alreadyFailed = await this.dataSource.getRepository(RewardRedemption).findOne({
        where: { id: redemptionId, status: 'FAILED' as RedemptionStatus },
      });
      if (alreadyFailed) {
        redemption = alreadyFailed;
        return redemption;
      }

      let originalDebitAmount = totalTenantDebit;
      const originalDebit = await this.dataSource
        .getRepository(TenantWalletTransaction)
        .findOne({ where: { reference: redemptionId, type: 'SPENT' } });
      if (originalDebit) {
        originalDebitAmount = Math.abs(Number(originalDebit.amount));
      }

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
            {
              redemptionId,
              tenantId,
              memberId,
              failed: 'FAILED' as RedemptionStatus,
            },
          )
          .execute();

        if (!flip.affected) {
          return;
        }

        await this.pointsService.refundPoints(
          tenantId,
          memberId,
          pointsCost,
          redemptionId,
          input.rewardName ?? input.rewardId,
          errorMessage,
        );

        if (input.rewardType !== 'CUSTOM') {
          const walletRepo = manager.getRepository(TenantWallet);
          const wallet = await walletRepo
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

              const refundTx = manager.getRepository(TenantWalletTransaction).create({
                tenantWalletId: wallet.id,
                type: 'REFUND',
                amount: originalDebitAmount,
                reference: `refund:${redemptionId}`,
                description: `Refund: ${input.rewardName ?? input.rewardId}`,
                status: 'COMPLETED',
                rawAmount: originalDebitAmount,
                metadata: { actorMemberId: memberId },
              });
              await manager.getRepository(TenantWalletTransaction).save(refundTx);
            }
          }
        }

        if (input.rewardType === 'CUSTOM') {
          const cr = await manager
            .getRepository(CustomReward)
            .findOne({ where: { id: input.rewardId, tenantId } });
          if (cr && cr.stockLimit !== null) {
            await manager.getRepository(CustomReward).update(cr.id, {
              stockLimit: cr.stockLimit + 1,
            });
          }
        }
      });

      redemption = await this.dataSource.getRepository(RewardRedemption).findOneOrFail({
        where: { id: redemptionId, tenantId, memberId },
      });
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
      .catch((err) => {
        this.logger.warn(
          `Failed to queue reward redemption activity: ${err instanceof Error ? err.message : err}`,
        );
      });

    return this.dataSource.getRepository(RewardRedemption).findOneOrFail({
      where: { id: redemptionId, tenantId, memberId },
    });
  }

  private async runClaimFulfillment(
    redemption: RewardRedemption,
    input: ClaimInput,
  ): Promise<void> {
    if (input.rewardType === 'TREMENDOUS') {
      await this.fulfillTremendous(redemption, input);
      return;
    }
    if (input.rewardType === 'NOMBA_AIRTIME') {
      await this.fulfillNombaTopup(redemption, input);
      return;
    }
    if (input.rewardType === 'NOMBA_UTILITY') {
      await this.fulfillNombaUtility(redemption, input);
      return;
    }
    if (input.rewardType === 'CUSTOM') {
      await this.fulfillCustom(redemption);
    }
  }

  private async fulfillTremendous(redemption: RewardRedemption, input: ClaimInput): Promise<void> {
    const productId = this.extractTremendousProductId(input.rewardId);
    if (!productId) {
      throw new Error('Missing Tremendous productId for gift card order');
    }

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
    if (!recipientEmail) {
      throw new Error('Recipient email is required to issue a Tremendous reward');
    }

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
    ) {
      throw new Error(
        `Tremendous order was not fulfilled: ${orderStatus ?? deliveryStatus ?? 'unknown status'}`,
      );
    }

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

    if (deliveryLink) {
      void this.sendRewardClaimEmail({
        recipientEmail,
        recipientName,
        redemption,
        deliveryLink,
      }).catch((err) => {
        this.logger.warn(
          `Failed to send reward claim email for ${redemption.id}: ${err instanceof Error ? err.message : err}`,
        );
      });
    }
  }

  private async sendRewardClaimEmail(params: {
    recipientEmail: string;
    recipientName: string;
    redemption: RewardRedemption;
    deliveryLink: string;
  }): Promise<void> {
    const { recipientEmail, recipientName, redemption, deliveryLink } = params;

    const rendered = this.emailTemplateService.render('reward-claim', {
      employeeName: recipientName,
      employeeEmail: recipientEmail,
      rewardName: redemption.rewardName ?? 'Gift Card',
      rewardAmount: redemption.currencyValue,
      currencyCode: redemption.currencyCode,
      redemptionUrl: deliveryLink,
      referenceId: redemption.id,
      providerName: 'Tremendous',
      providerLogoUrl: 'https://www.tremendous.com/img/tremendous-logo.png',
    });

    await this.emailService.sendEmail({
      to: recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  private async fulfillNombaTopup(redemption: RewardRedemption, input: ClaimInput): Promise<void> {
    if (!input.recipientPhone || !input.airtimeNetwork) {
      throw new Error('Phone number and network are required for mobile top-up');
    }

    const isData = input.topupKind === 'data';
    const useMonnify = this.providerService.useMonnifyNgBills();

    let result: { success: boolean; transactionId: string | null; status: string };
    if (useMonnify) {
      const purchaseInput = {
        amount: redemption.currencyValue,
        phoneNumber: input.recipientPhone,
        network: input.airtimeNetwork,
        merchantTxRef: redemption.id,
      };
      result = isData
        ? await this.monnifyBillApi.purchaseDataBundle(purchaseInput)
        : await this.monnifyBillApi.purchaseAirtime(purchaseInput);
    } else {
      const senderName = await this.resolveSenderName(redemption.tenantId);
      const purchaseInput = {
        amount: redemption.currencyValue,
        phoneNumber: input.recipientPhone,
        network: input.airtimeNetwork,
        merchantTxRef: redemption.id,
        senderName,
      };
      result = isData
        ? await this.nombaBillApi.purchaseDataBundle(purchaseInput)
        : await this.nombaBillApi.purchaseAirtime(purchaseInput);
    }

    if (!result.success) {
      throw new Error(
        `${isData ? 'Data bundle' : 'Airtime'} purchase failed: status ${result.status}`,
      );
    }

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
  }

  private async fulfillNombaUtility(
    redemption: RewardRedemption,
    input: ClaimInput,
  ): Promise<void> {
    if (!input.accountNumber || !input.billerId || !input.serviceType) {
      throw new Error('Meter number, biller ID, and service type are required for utility payment');
    }

    const purchaseInput = {
      amount: redemption.currencyValue,
      meterNumber: input.accountNumber,
      billerId: String(input.billerId),
      serviceType: input.serviceType as 'PREPAID' | 'POSTPAID',
      merchantTxRef: redemption.id,
    };

    const result = this.providerService.useMonnifyNgBills()
      ? await this.monnifyBillApi.purchaseElectricity(purchaseInput)
      : await this.nombaBillApi.purchaseElectricity(purchaseInput);

    if (!result.success) {
      throw new Error(`Electricity purchase failed: status ${result.status}`);
    }

    const instructions = result.token
      ? `Utility payment successful. Prepaid token: ${result.token}`
      : `Utility payment successful. Reference: ${result.transactionId}`;

    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      providerRef: { ...redemption.providerRef, txRef: result.transactionId ?? undefined },
      voucher: { code: result.token || undefined, instructions },
      processingStartedAt: null,
    });
  }

  private async fulfillCustom(redemption: RewardRedemption): Promise<void> {
    const customReward = await this.dataSource.getRepository(CustomReward).findOne({
      where: { id: redemption.rewardId ?? undefined },
    });

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

  async getMyClaims(tenantId: string, memberId: string): Promise<RewardRedemption[]> {
    return this.dataSource.getRepository(RewardRedemption).find({
      where: { tenantId, memberId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getAllClaims(tenantId: string): Promise<RewardRedemption[]> {
    return this.dataSource.getRepository(RewardRedemption).find({
      where: { tenantId },
      relations: ['member'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  private async getSubscriptionFees(
    tenantId: string,
    _walletCurrency: string,
  ): Promise<{ feePercentage: number; flatFee: number }> {
    return { feePercentage: 2, flatFee: 0 };
  }

  extractTremendousProductId(rewardId: string): string | undefined {
    if (!rewardId.startsWith('tremendous_')) return undefined;
    const rest = rewardId.slice('tremendous_'.length);
    const withCountry = rest.match(/^([A-Z]{2})_(.+)$/);
    return withCountry ? withCountry[2] : rest || undefined;
  }
}
