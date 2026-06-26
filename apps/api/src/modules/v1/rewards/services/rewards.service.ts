import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ShoutoutPointTransactionType } from 'src/common/enums/shoutout-point-transaction-type.enum';
import type { RewardsSettings } from 'src/common/interfaces/rewards-settings.interface';
import { NombaBillApiService } from 'src/common/services/nomba-bill-api.service';
import { ReloadlyApiService, type ReloadlyProduct } from 'src/common/services/reloadly-api.service';
import { DataSource } from 'typeorm';
import { ShoutoutMemberPoints } from '../../shoutouts/entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from '../../shoutouts/entities/shoutout-point-transaction.entity';
import { TenantConfigService } from '../../tenant-settings/services/tenant-config.service';
import { CustomReward } from '../entities/custom-reward.entity';
import { RewardRedemption, type RedemptionStatus, type RewardType } from '../entities/reward-redemption.entity';
import { NombaTransferApiService } from 'src/common/services/nomba-transfer-api.service';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { CustomRewardsService } from './custom-rewards.service';
import { TenantWalletService } from './tenant-wallet.service';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';
import { Task } from '../entities/task.entity';
import { TaskSubmission } from '../entities/task-submission.entity';

export interface CatalogItem {
  id: string;
  name: string;
  type: RewardType;
  pointsCost: number;
  currencyValue: number;
  currencyCode: string;
  countryCode?: string;
  imageUrl?: string | null;
  denominationType?: string;
  minDenomination?: number | null;
  maxDenomination?: number | null;
  fixedDenominations?: number[];
  deliveryInstructions?: string | null;
  stockLimit?: number | null;
}

export interface ClaimInput {
  rewardType: RewardType;
  rewardId: string;
  rewardName?: string;
  pointsCost: number;
  currencyValue: number;
  currencyCode?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  /** For Reloadly: product ID. For airtime: network provider. */
  providerProductId?: number;
  airtimeNetwork?: 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';
}

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly walletService: TenantWalletService,
    private readonly customRewardsService: CustomRewardsService,
    private readonly tenantConfigService: TenantConfigService,
    private readonly reloadlyApi: ReloadlyApiService,
    private readonly nombaBillApi: NombaBillApiService,
    private readonly nombaTransferApi: NombaTransferApiService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Helper to convert between currencies (e.g. USD -> NGN, or NGN -> NGN).
   */
  private convertCurrency(amount: number, from: string, to: string): number {
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();
    if (fromUpper === toUpper) {
      return amount;
    }

    // Platform exchange rates (NGN base)
    // 1 USD = 1,500 NGN
    // 1 EUR = 1,600 NGN
    // 1 GBP = 1,900 NGN
    const ratesToNgn: Record<string, number> = {
      USD: 1500,
      EUR: 1600,
      GBP: 1900,
      NGN: 1,
    };

    const fromRate = ratesToNgn[fromUpper] ?? 1;
    const toRate = ratesToNgn[toUpper] ?? 1;

    // Convert from source currency to NGN, then to target currency
    const amountInNgn = amount * fromRate;
    return Number((amountInNgn / toRate).toFixed(2));
  }

  /**
   * Helper to retrieve subscription fee percentage and flat fee for a tenant.
   */
  async getSubscriptionFees(tenantId: string, walletCurrency: string): Promise<{ feePercentage: number; flatFee: number }> {
    try {
      const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
      const feePercentage = subscription?.planPrice?.regionalConfig?.rewardsFeePercentage ?? 2; // Default 2%
      
      // Default flat fee is 50 NGN. Convert it to the tenant's wallet currency.
      const rawFlatFee = subscription?.planPrice?.regionalConfig?.rewardsFlatFee ?? 50;
      const flatFee = this.convertCurrency(rawFlatFee, 'NGN', walletCurrency);
      
      return { feePercentage, flatFee };
    } catch {
      const flatFee = this.convertCurrency(50, 'NGN', walletCurrency);
      return { feePercentage: 2, flatFee };
    }
  }

  /**
   * Public helper to retrieve redemption fees.
   */
  async getRedemptionFees(tenantId: string, currency: string) {
    return this.getSubscriptionFees(tenantId, currency);
  }

  /**
   * Get the rewards settings for a tenant, with sensible defaults.
   */
  private async getRewardsSettings(tenantId: string): Promise<RewardsSettings> {
    const settingsRecord = await this.tenantConfigService.getPointsSettings(tenantId);
    // Read rewards from the raw settings record
    const repo = this.dataSource.getRepository(
      (await import('../../tenant-settings/entities/tenant-settings.entity')).TenantSettings,
    );
    const row = await repo.findOne({ where: { tenantId } });
    const rewards = row?.settings?.rewards;

    return {
      enabled: true,
      pointsExchangeRate: rewards?.pointsExchangeRate ?? 10,
      rewardsCurrency: rewards?.rewardsCurrency ?? 'NGN',
      catalogCountries: rewards?.catalogCountries ?? ['NG'],
      airtimeEnabled: true,
      customRewardsEnabled: true,
    };
  }

  /**
   * Get all countries supported by Reloadly, falling back to a static list if not configured.
   */
  async getReloadlyCountries(tenantId: string): Promise<any[]> {
    if (!this.reloadlyApi.isConfigured()) {
      return [
        { code: 'NG', name: 'Nigeria' },
        { code: 'US', name: 'United States' },
        { code: 'GB', name: 'United Kingdom' },
        { code: 'CA', name: 'Canada' },
        { code: 'GH', name: 'Ghana' },
        { code: 'KE', name: 'Kenya' },
        { code: 'ZA', name: 'South Africa' },
      ];
    }
    const countries = await this.reloadlyApi.listCountries();
    return countries.map((c) => ({
      code: c.code || c.countryCode,
      name: c.name || c.countryName || c.code,
    }));
  }

  /**
   * Build the unified rewards catalog for a tenant.
   * Combines Reloadly gift card products + custom rewards.
   */
  async getCatalog(tenantId: string): Promise<CatalogItem[]> {
    const settings = await this.getRewardsSettings(tenantId);
    if (!settings.enabled) {
      return [];
    }

    const exchangeRate = settings.pointsExchangeRate;
    const catalog: CatalogItem[] = [];

    // 1. Configured Reloadly products (saved in tenant settings)
    const reloadlyProducts = settings.reloadlyProducts ?? [];
    for (const p of reloadlyProducts) {
      catalog.push({
        id: `reloadly_${p.productId}`,
        name: p.name,
        type: 'RELOADLY',
        pointsCost: p.pointsCost,
        currencyValue: p.pointsCost / exchangeRate,
        currencyCode: p.currencyCode,
        countryCode: p.countryCode,
        imageUrl: p.imageUrl,
        minDenomination: p.minDenomination ?? null,
        maxDenomination: p.maxDenomination ?? null,
        fixedDenominations: p.fixedDenominations ?? [],
      });
    }

    // 2. Custom rewards
    if (settings.customRewardsEnabled) {
      const customRewards = await this.customRewardsService.list(tenantId);
      for (const cr of customRewards) {
        catalog.push({
          id: `custom_${cr.id}`,
          name: cr.title,
          type: 'CUSTOM',
          pointsCost: cr.pointsCost,
          currencyValue: cr.pointsCost / exchangeRate,
          currencyCode: settings.rewardsCurrency,
          imageUrl: cr.imageUrl,
          deliveryInstructions: cr.deliveryInstructions,
          stockLimit: cr.stockLimit,
        });
      }
    }

    return catalog;
  }

  /**
   * Get all available Reloadly products for allowed countries so the admin can add/edit/remove them.
   */
  async getAvailableReloadlyProducts(tenantId: string): Promise<any[]> {
    const settings = await this.getRewardsSettings(tenantId);
    if (!this.reloadlyApi.isConfigured() || settings.catalogCountries.length === 0) {
      return [];
    }

    try {
      const products = await this.reloadlyApi.listProductsByCountries(settings.catalogCountries);
      const { feePercentage, flatFee } = await this.getSubscriptionFees(tenantId, settings.rewardsCurrency);
      const exchangeRate = settings.pointsExchangeRate;

      return products.map((p) => {
        const currencyValue = p.fixedRecipientDenominations?.[0] ?? p.minRecipientDenomination ?? 0;
        const convertedValue = this.convertCurrency(
          currencyValue,
          p.recipientCurrencyCode,
          settings.rewardsCurrency,
        );

        const markupFactor = 1 + feePercentage / 100;
        const chargedValue = convertedValue * markupFactor + flatFee;
        const defaultPointsCost = Math.ceil(chargedValue * exchangeRate);

        return {
          productId: p.productId,
          name: p.productName,
          countryCode: p.countryCode,
          currencyCode: p.recipientCurrencyCode,
          imageUrl: p.logoUrls?.[0] ?? null,
          minDenomination: p.minRecipientDenomination ?? null,
          maxDenomination: p.maxRecipientDenomination ?? null,
          fixedDenominations: p.fixedRecipientDenominations ?? [],
          defaultPointsCost,
        };
      });
    } catch (error) {
      this.logger.warn(`Failed to fetch raw Reloadly catalog: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Three-phase claim state machine:
   * Phase 1: Atomically debit points + wallet balance (status: PENDING)
   * Phase 2: External API call (Reloadly / Nomba) — outside DB transaction
   * Phase 3: Update status to SUCCESS or FAILED (refund on failure)
   */
  async claim(
    tenantId: string,
    memberId: string,
    input: ClaimInput,
  ): Promise<RewardRedemption> {
    const settings = await this.getRewardsSettings(tenantId);
    if (!settings.enabled) {
      throw new BadRequestException('Rewards are not enabled for this workspace');
    }

    const exchangeRate = settings.pointsExchangeRate;
    const currencyCode = input.currencyCode ?? settings.rewardsCurrency;
    const currencyValue = input.currencyValue;
    const pointsCost = input.pointsCost;

    const redemptionId = randomUUID();

    const { feePercentage, flatFee } = await this.getSubscriptionFees(tenantId, settings.rewardsCurrency);

    // 1. Calculate and validate the expected points cost
    const expectedConvertedValue = this.convertCurrency(
      currencyValue,
      currencyCode,
      settings.rewardsCurrency,
    );

    let totalTenantDebit = expectedConvertedValue;
    if (input.rewardType !== 'CUSTOM') {
      const markupFactor = 1 + feePercentage / 100;
      totalTenantDebit = expectedConvertedValue * markupFactor + flatFee;
    }

    const expectedPointsCost = input.rewardType === 'CUSTOM'
      ? pointsCost // custom points cost is validated against CustomReward entity in transaction
      : Math.ceil(totalTenantDebit * exchangeRate);

    if (input.rewardType !== 'CUSTOM' && pointsCost < expectedPointsCost) {
      throw new BadRequestException(
        `Invalid points cost. Expected at least ${expectedPointsCost} points for this reward.`,
      );
    }

    // =========================================================================
    // PHASE 1: Reserve points + wallet balance atomically
    // =========================================================================
    let redemption: RewardRedemption;
    await this.dataSource.transaction(async (manager) => {
      // For custom rewards, perform stock limit checks and decrement
      if (input.rewardType === 'CUSTOM') {
        const customRewardRepo = manager.getRepository(CustomReward);
        const cr = await customRewardRepo.findOneOrFail({ where: { id: input.rewardId, tenantId } });
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

      // 1a. Verify and debit user points
      const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
      const memberPoints = await pointsRepo.findOne({ where: { tenantId, memberId } });
      if (!memberPoints || memberPoints.currentBalance < pointsCost) {
        throw new BadRequestException(
          `Insufficient points. You need ${pointsCost} points but have ${memberPoints?.currentBalance ?? 0}.`,
        );
      }

      // Atomic points decrement
      await pointsRepo
        .createQueryBuilder()
        .update(ShoutoutMemberPoints)
        .set({ currentBalance: () => `current_balance - ${pointsCost}` })
        .where('tenant_id = :tenantId AND member_id = :memberId AND current_balance >= :pointsCost', {
          tenantId,
          memberId,
          pointsCost,
        })
        .execute();

      // Record points transaction
      const txRepo = manager.getRepository(ShoutoutPointTransaction);
      const updatedPoints = await pointsRepo.findOneOrFail({ where: { tenantId, memberId } });
      const pointsTx = txRepo.create({
        tenantId,
        memberId,
        type: ShoutoutPointTransactionType.REDEMPTION,
        points: -pointsCost,
        runningBalance: updatedPoints.currentBalance,
        description: `Redeemed for: ${input.rewardName ?? input.rewardId}`,
        createdBy: memberId,
      });
      await txRepo.save(pointsTx);

      // 1b. Debit tenant wallet (for Reloadly / Nomba fulfillment costs + platform fees)
      if (input.rewardType !== 'CUSTOM') {
        await this.walletService.debit(
          tenantId,
          totalTenantDebit,
          redemptionId,
          `Reward claim: ${input.rewardName ?? input.rewardId} (Face Value: ${currencyCode} ${currencyValue}, Platform Fees: ${Number((totalTenantDebit - expectedConvertedValue).toFixed(2))})`,
          manager,
        );
      }

      // 1c. Create the redemption record as PENDING
      const redemptionRepo = manager.getRepository(RewardRedemption);
      redemption = redemptionRepo.create({
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
        recipientEmail: input.recipientEmail ?? null,
        recipientPhone: input.recipientPhone ?? null,
      });
      await redemptionRepo.save(redemption);
    });

    // =========================================================================
    // PHASE 2: External API call (outside DB transaction!)
    // =========================================================================
    try {
      if (input.rewardType === 'RELOADLY') {
        await this.fulfillReloadly(redemption!, input);
      } else if (input.rewardType === 'NOMBA_AIRTIME') {
        await this.fulfillAirtime(redemption!, input);
      } else if (input.rewardType === 'CUSTOM') {
        await this.fulfillCustom(redemption!);
      }
    } catch (error) {
      // =====================================================================
      // PHASE 3 (failure): Refund points + wallet balance
      // =====================================================================
      const errorMessage = error instanceof Error ? error.message : 'Unknown fulfillment error';
      this.logger.error(`Reward fulfillment failed for ${redemptionId}: ${errorMessage}`);

      await this.dataSource.transaction(async (manager) => {
        // Refund points
        const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
        await pointsRepo
          .createQueryBuilder()
          .update(ShoutoutMemberPoints)
          .set({ currentBalance: () => `current_balance + ${pointsCost}` })
          .where('tenant_id = :tenantId AND member_id = :memberId', { tenantId, memberId })
          .execute();

        // Record refund transaction
        const txRepo = manager.getRepository(ShoutoutPointTransaction);
        const updatedPoints = await pointsRepo.findOneOrFail({ where: { tenantId, memberId } });
        const refundTx = txRepo.create({
          tenantId,
          memberId,
          type: ShoutoutPointTransactionType.REDEMPTION,
          points: pointsCost,
          runningBalance: updatedPoints.currentBalance,
          description: `Refund: ${input.rewardName ?? input.rewardId} — ${errorMessage}`,
          createdBy: memberId,
        });
        await txRepo.save(refundTx);

        // Refund wallet if not custom
        if (input.rewardType !== 'CUSTOM') {
          const markupFactor = 1 + feePercentage / 100;
          const totalTenantDebit = expectedConvertedValue * markupFactor + flatFee;
          await this.walletService.credit(
            tenantId,
            totalTenantDebit,
            'REFUND',
            redemptionId,
            `Refund: ${input.rewardName ?? input.rewardId}`,
            manager,
          );
        }

        // Refund custom reward stock limit if applicable
        if (input.rewardType === 'CUSTOM') {
          const customRewardRepo = manager.getRepository(CustomReward);
          const cr = await customRewardRepo.findOne({ where: { id: input.rewardId, tenantId } });
          if (cr && cr.stockLimit !== null) {
            await customRewardRepo.update(cr.id, {
              stockLimit: cr.stockLimit + 1,
            });
          }
        }

        // Mark redemption as FAILED
        const redemptionRepo = manager.getRepository(RewardRedemption);
        await redemptionRepo.update(redemptionId, {
          status: 'FAILED' as RedemptionStatus,
          errorMessage,
        });
      });

      // Re-fetch the updated redemption
      redemption = await this.dataSource.getRepository(RewardRedemption).findOneOrFail({
        where: { id: redemptionId },
      });
    }

    return redemption!;
  }

  /**
   * Fulfill a Reloadly gift card order.
   */
  private async fulfillReloadly(redemption: RewardRedemption, input: ClaimInput): Promise<void> {
    const productId = input.providerProductId;
    if (!productId) {
      throw new Error('Missing Reloadly productId for gift card order');
    }

    const orderResponse = await this.reloadlyApi.orderGiftCard({
      productId,
      quantity: 1,
      unitPrice: redemption.currencyValue,
      customIdentifier: redemption.id,
      recipientEmail: redemption.recipientEmail ?? undefined,
      senderName: 'Paqad HR',
    });

    const transactionId = orderResponse.transactionId;

    // Try to get redemption codes
    let voucherCode: string | null = null;
    let voucherPin: string | null = null;

    if (transactionId) {
      try {
        const codes = await this.reloadlyApi.getRedemptionCodes(transactionId);
        if (codes?.[0]) {
          voucherCode = codes[0].cardNumber ?? null;
          voucherPin = codes[0].pinCode ?? null;
        }
      } catch (e) {
        this.logger.warn(`Could not fetch redemption codes for transaction ${transactionId}: ${e}`);
      }
    }

    // Update redemption as SUCCESS
    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      providerTxRef: transactionId ? String(transactionId) : null,
      voucherCode,
      voucherPin,
      voucherInstructions: 'Present this code at any participating store to redeem.',
    });
  }

  /**
   * Fulfill a Nomba airtime top-up.
   */
  private async fulfillAirtime(redemption: RewardRedemption, input: ClaimInput): Promise<void> {
    if (!input.recipientPhone || !input.airtimeNetwork) {
      throw new Error('Phone number and network are required for airtime top-up');
    }

    const result = await this.nombaBillApi.purchaseAirtime({
      amount: redemption.currencyValue,
      phoneNumber: input.recipientPhone,
      network: input.airtimeNetwork,
      merchantTxRef: redemption.id,
      senderName: 'PAQAD HR',
    });

    if (!result.success) {
      throw new Error(`Airtime purchase failed: status ${result.status}`);
    }

    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      providerTxRef: result.transactionId,
      voucherInstructions: `Airtime of ${redemption.currencyCode} ${redemption.currencyValue} sent to ${input.recipientPhone}`,
    });
  }

  /**
   * Fulfill a custom reward (no external API — just mark complete and notify admin).
   */
  private async fulfillCustom(redemption: RewardRedemption): Promise<void> {
    // For custom rewards, we just mark as SUCCESS immediately.
    // The admin will see it in their claims list and manually fulfill (deliver lunch, etc.)
    const customReward = await this.dataSource.getRepository(CustomReward).findOne({
      where: { id: redemption.rewardId ?? undefined },
    });

    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      voucherInstructions:
        customReward?.deliveryInstructions ?? 'Your admin has been notified and will fulfill this reward.',
    });
  }

  /**
   * Get claim history for a member.
   */
  async getMyClaims(tenantId: string, memberId: string): Promise<RewardRedemption[]> {
    return this.dataSource.getRepository(RewardRedemption).find({
      where: { tenantId, memberId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  /**
   * Get all claims for a tenant (admin view).
   */
  async getAllClaims(tenantId: string): Promise<RewardRedemption[]> {
    return this.dataSource.getRepository(RewardRedemption).find({
      where: { tenantId },
      relations: ['member'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
  /**
   * Process a Nomba webhook event for virtual account funding deposits.
   */
  async handleNombaFundingWebhook(
    rawBody: string,
    signature: string,
  ): Promise<{ received: boolean }> {
    if (!signature?.trim()) {
      throw new BadRequestException('Missing webhook signature');
    }
    if (!this.nombaTransferApi.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    const eventType = String(
      payload.event_type || payload.eventType || payload.event || '',
    ).toLowerCase();

    if (
      !eventType.includes('deposit') &&
      !eventType.includes('virtualaccount') &&
      !eventType.includes('transfer.success')
    ) {
      return { received: true };
    }

    const data = payload.data || {};
    const accountNumber = String(
      data.virtualAccount ||
        data.accountNumber ||
        data.virtualAccountNumber ||
        '',
    );
    const amount = Number(data.amount || data.paymentAmount || 0);
    const reference = String(
      data.transactionReference ||
        data.orderReference ||
        data.reference ||
        data.id ||
        '',
    );

    if (!accountNumber || amount <= 0 || !reference) {
      throw new BadRequestException('Invalid webhook payload structure');
    }

    const walletRepo = this.dataSource.getRepository(TenantWallet);
    const wallet = await walletRepo.findOne({
      where: { virtualAccountNumber: accountNumber },
    });
    if (!wallet) {
      this.logger.warn(
        `Received deposit webhook for unregistered virtual account: ${accountNumber}`,
      );
      return { received: true };
    }

    await this.dataSource.transaction(async (manager) => {
      const txRepo = manager.getRepository(TenantWalletTransaction);
      const existingTx = await txRepo.findOne({ where: { reference } });
      if (existingTx) {
        this.logger.log(
          `Skipping duplicate wallet deposit transaction: ${reference}`,
        );
        return;
      }

      await this.walletService.credit(
        wallet.tenantId,
        amount,
        'DEPOSIT',
        reference,
        `Bank deposit to virtual account ${accountNumber}`,
        manager,
      );
    });

    return { received: true };
  }

  // ─── Points Tasks & Verification (Database-backed) ───────────────────────────

  async listTasks(tenantId: string, memberId: string) {
    const taskRepo = this.dataSource.getRepository(Task);
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);

    const tasks = await taskRepo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });

    if (tasks.length === 0) {
      // Seed default tasks
      const defaultTasksData: Array<{
        title: string;
        description: string;
        points: number;
        icon: string;
        category?: string;
        imageUrl?: string;
        submissionType: 'instant' | 'text' | 'file';
      }> = [
        {
          title: 'Welcome Tour',
          description: 'Take a quick 2-minute tour of the workspace and navigation.',
          points: 10,
          icon: 'Compass',
          category: 'Onboarding',
          imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=150&auto=format&fit=crop&q=60',
          submissionType: 'instant',
        },
        {
          title: 'Profile Picture Check',
          description: 'Upload your avatar so your teammates can easily recognize you.',
          points: 25,
          icon: 'User',
          category: 'Profile',
          imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=60',
          submissionType: 'file',
        },
        {
          title: 'Spread Appreciation',
          description: 'Recognize a colleague by writing and sending your first shoutout.',
          points: 15,
          icon: 'Heart',
          category: 'Culture',
          imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=60',
          submissionType: 'instant',
        },
        {
          title: 'Core Value Champion',
          description: 'Tag your shoutout with a company core value category.',
          points: 20,
          icon: 'Award',
          category: 'Culture',
          imageUrl: 'https://images.unsplash.com/photo-1491336477066-31156b5e4f35?w=150&auto=format&fit=crop&q=60',
          submissionType: 'instant',
        },
        {
          title: 'Link Slack Profile',
          description: 'Sync your Slack profile to receive real-time celebration updates.',
          points: 10,
          icon: 'Slack',
          category: 'Integration',
          imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=150&auto=format&fit=crop&q=60',
          submissionType: 'text',
        },
      ];

      for (const d of defaultTasksData) {
        const t = taskRepo.create({
          tenantId,
          ...d,
        });
        await taskRepo.save(t);
      }

      // Re-fetch tasks
      return this.listTasks(tenantId, memberId);
    }

    const submissions = await submissionRepo.find({
      where: { tenantId, memberId },
    });

    // Map tasks to their current submission status
    return tasks.map((task) => {
      const sub = submissions.find((s) => s.taskId === task.id);
      return {
        id: task.id,
        title: task.title,
        description: task.description,
        points: task.points,
        icon: task.icon,
        category: task.category,
        imageUrl: task.imageUrl,
        submissionType: task.submissionType,
        completed: sub?.status === 'completed',
        status: sub?.status ?? 'available',
        submissionText: sub?.submissionText,
        submissionFileName: sub?.submissionFileName,
        submissionId: sub?.id,
      };
    });
  }

  async listPendingSubmissions(tenantId: string) {
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);
    const taskRepo = this.dataSource.getRepository(Task);

    const submissions = await submissionRepo.find({
      where: { tenantId, status: 'pending' },
      order: { createdAt: 'DESC' },
    });

    if (submissions.length === 0) return [];

    const tasks = await taskRepo.find({
      where: { tenantId },
    });

    return submissions.map((sub) => {
      const task = tasks.find((t) => t.id === sub.taskId);
      return {
        id: task?.id ?? sub.taskId,
        submissionId: sub.id,
        title: task?.title ?? 'Unknown Task',
        description: task?.description ?? '',
        points: task?.points ?? 0,
        icon: task?.icon ?? 'Sparkles',
        category: task?.category,
        imageUrl: task?.imageUrl,
        submissionType: task?.submissionType ?? 'instant',
        status: sub.status,
        submissionText: sub.submissionText,
        submissionFileName: sub.submissionFileName,
        memberId: sub.memberId,
      };
    });
  }

  async createTask(
    tenantId: string,
    data: {
      title: string;
      description: string;
      points: number;
      icon: string;
      category?: string;
      imageUrl?: string;
      submissionType: 'instant' | 'text' | 'file';
    },
  ) {
    const taskRepo = this.dataSource.getRepository(Task);
    const task = taskRepo.create({
      tenantId,
      title: data.title,
      description: data.description,
      points: data.points,
      icon: data.icon,
      category: data.category ?? undefined,
      imageUrl: data.imageUrl ?? undefined,
      submissionType: data.submissionType,
    });
    return taskRepo.save(task);
  }

  async deleteTask(tenantId: string, taskId: string) {
    const taskRepo = this.dataSource.getRepository(Task);
    const task = await taskRepo.findOne({ where: { id: taskId, tenantId } });
    if (!task) {
      throw new BadRequestException('Task not found');
    }
    await taskRepo.remove(task);
    return { success: true };
  }

  async submitTask(
    tenantId: string,
    taskId: string,
    memberId: string,
    data: {
      submissionText?: string;
      submissionFileName?: string;
    },
  ) {
    const taskRepo = this.dataSource.getRepository(Task);
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);

    const task = await taskRepo.findOne({ where: { id: taskId, tenantId } });
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    // Check if already completed
    let sub = await submissionRepo.findOne({ where: { taskId, memberId, tenantId } });
    if (sub && sub.status === 'completed') {
      throw new BadRequestException('Task already completed');
    }

    const isInstant = task.submissionType === 'instant';
    const status: 'pending' | 'completed' | 'rejected' = isInstant ? 'completed' : 'pending';

    if (!sub) {
      sub = submissionRepo.create({
        tenantId,
        taskId,
        memberId,
        status,
        submissionText: data.submissionText ?? undefined,
        submissionFileName: data.submissionFileName ?? undefined,
      });
    } else {
      sub.status = status;
      sub.submissionText = data.submissionText ?? sub.submissionText;
      sub.submissionFileName = data.submissionFileName ?? sub.submissionFileName;
    }

    await submissionRepo.save(sub!);

    // If instant, award points immediately
    if (isInstant) {
      await this.awardPointsForTask(tenantId, memberId, task.points, task.title);
    }

    return {
      success: true,
      status,
      pointsAwarded: isInstant ? task.points : 0,
    };
  }

  async approveSubmission(tenantId: string, taskId: string, submissionId: string) {
    const taskRepo = this.dataSource.getRepository(Task);
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);

    const sub = await submissionRepo.findOne({ where: { id: submissionId, tenantId, taskId } });
    if (!sub) {
      throw new BadRequestException('Submission not found');
    }
    if (sub.status === 'completed') {
      throw new BadRequestException('Submission already approved');
    }

    const task = await taskRepo.findOne({ where: { id: taskId, tenantId } });
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    sub.status = 'completed';
    await submissionRepo.save(sub);

    // Award points
    await this.awardPointsForTask(tenantId, sub.memberId, task.points, task.title);

    return { success: true };
  }

  async rejectSubmission(tenantId: string, taskId: string, submissionId: string) {
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);

    const sub = await submissionRepo.findOne({ where: { id: submissionId, tenantId, taskId } });
    if (!sub) {
      throw new BadRequestException('Submission not found');
    }

    sub.status = 'rejected';
    await submissionRepo.save(sub);

    return { success: true };
  }

  private async awardPointsForTask(tenantId: string, memberId: string, points: number, taskTitle: string) {
    await this.dataSource.transaction(async (manager) => {
      const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
      const txRepo = manager.getRepository(ShoutoutPointTransaction);

      let row = await pointsRepo.findOne({ where: { tenantId, memberId } });
      if (!row) {
        row = pointsRepo.create({
          tenantId,
          memberId,
          currentBalance: 0,
          totalEarned: 0,
          lastResetDate: new Date(),
        });
      }

      row.currentBalance += points;
      row.totalEarned += points;
      await manager.save(row);

      await txRepo.save(
        txRepo.create({
          tenantId,
          memberId,
          type: ShoutoutPointTransactionType.ADMIN_ASSIGN, // Treat task points as admin assigned/checklist grant
          points,
          runningBalance: row.currentBalance,
          description: `Completed task: ${taskTitle}`,
          createdBy: memberId,
        }),
      );
    });
  }
}
