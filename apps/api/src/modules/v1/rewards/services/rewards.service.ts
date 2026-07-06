import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { formatNombaSenderName } from 'src/common/config/nomba.config';
import { ShoutoutPointTransactionType } from 'src/common/enums/shoutout-point-transaction-type.enum';
import type { RewardsSettings } from 'src/common/interfaces/rewards-settings.interface';
import { FiatExchangeService } from 'src/common/services/fiat-exchange.service';
import { NombaBillApiService } from 'src/common/services/nomba-bill-api.service';
import { NombaTransferApiService } from 'src/common/services/nomba-transfer-api.service';
import { ReloadlyApiService } from 'src/common/services/reloadly-api.service';
import { ReloadlyTopupsApiService } from 'src/common/services/reloadly-topups-api.service';
import { ReloadlyUtilitiesApiService } from 'src/common/services/reloadly-utilities-api.service';
import { DataSource } from 'typeorm';
import { ActivitiesService } from '../../activities/services/activities.service';
import { Employment } from '../../employment/entities/employment.entity';
import { Shoutout } from '../../shoutouts/entities/shoutout.entity';
import { ShoutoutMemberPoints } from '../../shoutouts/entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from '../../shoutouts/entities/shoutout-point-transaction.entity';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TenantSettings } from '../../tenant-settings/entities/tenant-settings.entity';
import { TenantConfigService } from '../../tenant-settings/services/tenant-config.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { CustomReward } from '../entities/custom-reward.entity';
import { MisdirectedDeposit } from '../entities/misdirected-deposit.entity';
import {
  type RedemptionStatus,
  RewardRedemption,
  type RewardType,
} from '../entities/reward-redemption.entity';
import { Task } from '../entities/task.entity';
import { TaskSubmission } from '../entities/task-submission.entity';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';
import { computeRedemptionDebit } from '../utils/rewards-redemption.util';
import { CustomRewardsService } from './custom-rewards.service';
import { TenantWalletService } from './tenant-wallet.service';

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
  adminPricing?: {
    reloadlyCost: number;
    reloadlyCostCurrency: string;
  };
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

  providerProductId?: number;
  airtimeNetwork?: 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';
  topupKind?: 'airtime' | 'data';
  billerId?: string | number;
  accountNumber?: string;
  serviceType?: string;
}

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly walletService: TenantWalletService,
    private readonly customRewardsService: CustomRewardsService,
    readonly _tenantConfigService: TenantConfigService,
    private readonly reloadlyApi: ReloadlyApiService,
    private readonly reloadlyTopupsApi: ReloadlyTopupsApiService,
    private readonly fiatExchange: FiatExchangeService,
    private readonly reloadlyUtilitiesApi: ReloadlyUtilitiesApiService,
    private readonly nombaBillApi: NombaBillApiService,
    readonly _nombaTransferApi: NombaTransferApiService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  private async toWalletCurrency(
    localAmount: number,
    localCurrency: string,
    walletCurrency: string,
    operatorId?: number,
    countryCode?: string,
  ): Promise<number> {
    return this.fiatExchange.convert(localAmount, localCurrency, walletCurrency, {
      operatorId,
      countryCode,
    });
  }

  private async resolveSenderName(tenantId: string): Promise<string> {
    const tenant = await this.dataSource.getRepository(Tenant).findOne({
      where: { id: tenantId },
      select: { name: true },
    });
    return formatNombaSenderName(tenant?.name);
  }

  private resolveReloadlyProduct(
    settings: RewardsSettings,
    rewardId: string,
  ): NonNullable<RewardsSettings['reloadlyProducts']>[number] | undefined {
    if (!rewardId.startsWith('reloadly_')) return undefined;
    const productId = Number(rewardId.replace('reloadly_', ''));
    if (!Number.isFinite(productId)) return undefined;
    return settings.reloadlyProducts?.find((p) => p.productId === productId);
  }

  private assertNgNombaRouting(input: ClaimInput, settings: RewardsSettings): void {
    const isNgCurrency =
      (input.currencyCode ?? settings.rewardsCurrency).toUpperCase() === 'NGN' &&
      settings.rewardsCurrency.toUpperCase() === 'NGN';

    if (input.rewardType === 'NOMBA_AIRTIME' || input.rewardType === 'NOMBA_UTILITY') {
      if (!this.nombaBillApi.isConfigured()) {
        throw new BadRequestException('Nomba billing is not configured for Nigeria redemptions');
      }
      return;
    }

    if (
      isNgCurrency &&
      (input.rewardType === 'RELOADLY_AIRTIME' || input.rewardType === 'RELOADLY_UTILITY')
    ) {
      throw new BadRequestException(
        'Nigeria airtime and utilities must use Nomba. Select Nigeria as the country.',
      );
    }
  }

  async listNombaDataPlans(network: string) {
    if (!this.nombaBillApi.isConfigured()) {
      throw new BadRequestException('Nomba billing is not configured');
    }
    return this.nombaBillApi.listDataPlans(network);
  }

  async getSubscriptionFees(
    tenantId: string,
    _walletCurrency: string,
  ): Promise<{ feePercentage: number; flatFee: number }> {
    try {
      const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
      const feePercentage = subscription?.planPrice?.regionalConfig?.rewardsFeePercentage ?? 2;
      return { feePercentage, flatFee: 0 };
    } catch {
      return { feePercentage: 2, flatFee: 0 };
    }
  }

  async getRedemptionFees(tenantId: string, currency: string) {
    return this.getSubscriptionFees(tenantId, currency);
  }

  private getReloadlyCategory(
    name: string,
  ): 'Airtime' | 'Money Cards' | 'Gift Cards' | 'Gaming Cards' {
    const lowerName = name.toLowerCase();

    if (
      lowerName.includes('airtime') ||
      lowerName.includes('mobile topup') ||
      lowerName.includes('refill') ||
      lowerName.includes('top-up') ||
      lowerName.includes('telecom') ||
      lowerName.includes('mtn') ||
      lowerName.includes('airtel') ||
      lowerName.includes('orange') ||
      lowerName.includes('vodafone') ||
      lowerName.includes('safaricom') ||
      lowerName.includes('tigo')
    ) {
      return 'Airtime';
    }

    if (
      lowerName.includes('visa') ||
      lowerName.includes('mastercard') ||
      lowerName.includes('american express') ||
      lowerName.includes('amex') ||
      lowerName.includes('prepaid card') ||
      lowerName.includes('cash') ||
      lowerName.includes('money')
    ) {
      return 'Money Cards';
    }

    if (
      lowerName.includes('playstation') ||
      lowerName.includes('xbox') ||
      lowerName.includes('steam') ||
      lowerName.includes('nintendo') ||
      lowerName.includes('roblox') ||
      lowerName.includes('pubg') ||
      lowerName.includes('razer') ||
      lowerName.includes('gaming') ||
      lowerName.includes('riot') ||
      lowerName.includes('league of legends') ||
      lowerName.includes('minecraft') ||
      lowerName.includes('nexon') ||
      lowerName.includes('twitch')
    ) {
      return 'Gaming Cards';
    }

    return 'Gift Cards';
  }

  private async getRewardsSettings(tenantId: string): Promise<RewardsSettings> {
    const repo = this.dataSource.getRepository(
      (await import('../../tenant-settings/entities/tenant-settings.entity')).TenantSettings,
    );
    const row = await repo.findOne({ where: { tenantId } });
    const rewards = row?.settings?.rewards;

    return {
      enabled: rewards?.enabled ?? true,
      pointsExchangeRate: rewards?.pointsExchangeRate ?? 1,
      rewardsCurrency: rewards?.rewardsCurrency ?? 'NGN',
      catalogCountries: rewards?.catalogCountries ?? ['NG'],
      airtimeEnabled: rewards?.airtimeEnabled ?? true,
      giftCardsEnabled: rewards?.giftCardsEnabled ?? true,
      giftCardCategories: rewards?.giftCardCategories ?? [
        'Gift Cards',
        'Gaming Cards',
        'Money Cards',
      ],
      utilityPaymentsEnabled: rewards?.utilityPaymentsEnabled ?? true,
      customRewardsEnabled: rewards?.customRewardsEnabled ?? true,
      reloadlyProducts: rewards?.reloadlyProducts ?? [],
    };
  }

  async getReloadlyCountries(tenantId: string): Promise<Array<{ code: string; name: string }>> {
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
      code: c.code || c.countryCode || '',
      name: c.name || c.countryName || c.code || c.countryCode || '',
    }));
  }

  async getCatalog(
    tenantId: string,
    options?: { includeAdminPricing?: boolean },
  ): Promise<CatalogItem[]> {
    let settings = await this.getRewardsSettings(tenantId);
    if (!settings.enabled) {
      return [];
    }

    if (
      (settings.reloadlyProducts ?? []).length === 0 &&
      this.reloadlyApi.isConfigured() &&
      settings.catalogCountries.length > 0
    ) {
      await this.syncReloadlyProducts(tenantId);
      settings = await this.getRewardsSettings(tenantId);
    }

    const exchangeRate = settings.pointsExchangeRate;
    const catalog: CatalogItem[] = [];

    const giftCardsEnabled = settings.giftCardsEnabled ?? true;
    const giftCardCategories = settings.giftCardCategories ?? [
      'Gift Cards',
      'Gaming Cards',
      'Money Cards',
    ];

    const reloadlyProducts = settings.reloadlyProducts ?? [];
    for (const p of reloadlyProducts) {
      const cat = this.getReloadlyCategory(p.name);
      if (cat === 'Airtime') {
        if (!settings.airtimeEnabled) continue;
      } else {
        if (!giftCardsEnabled) continue;
        if (!giftCardCategories.includes(cat)) continue;
      }

      catalog.push({
        id: `reloadly_${p.productId}`,
        name: p.name,
        type: 'RELOADLY',
        pointsCost: p.pointsCost,
        currencyValue: p.fixedDenominations?.[0] ?? p.minDenomination ?? 0,
        currencyCode: p.currencyCode,
        countryCode: p.countryCode,
        imageUrl: p.imageUrl,
        minDenomination: p.minDenomination ?? null,
        maxDenomination: p.maxDenomination ?? null,
        fixedDenominations: p.fixedDenominations ?? [],
        ...(options?.includeAdminPricing && p.listReloadlyCost != null && p.listReloadlyCostCurrency
          ? {
              adminPricing: {
                reloadlyCost: p.listReloadlyCost,
                reloadlyCostCurrency: p.listReloadlyCostCurrency,
              },
            }
          : {}),
      });
    }

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

  async syncReloadlyProducts(
    tenantId: string,
    options?: { force?: boolean },
  ): Promise<NonNullable<RewardsSettings['reloadlyProducts']>> {
    const repo = this.dataSource.getRepository(TenantSettings);
    const row = await repo.findOne({ where: { tenantId } });
    if (!row) {
      return [];
    }

    const existing = row.settings?.rewards?.reloadlyProducts ?? [];
    if (!options?.force && existing.length > 0) {
      return existing;
    }

    const settings = await this.getRewardsSettings(tenantId);
    if (!this.reloadlyApi.isConfigured() || settings.catalogCountries.length === 0) {
      return existing;
    }

    const products = await this.buildReloadlyProductRecords(tenantId, settings);
    row.settings = {
      ...row.settings,
      rewards: {
        ...settings,
        reloadlyProducts: products,
      },
    };
    await repo.save(row);
    return products;
  }

  private async buildReloadlyProductRecords(
    tenantId: string,
    settings: RewardsSettings,
  ): Promise<NonNullable<RewardsSettings['reloadlyProducts']>> {
    const products = await this.reloadlyApi.listProductsByCountries(settings.catalogCountries);
    const { feePercentage } = await this.getSubscriptionFees(tenantId, settings.rewardsCurrency);
    const exchangeRate = settings.pointsExchangeRate;

    const records: NonNullable<RewardsSettings['reloadlyProducts']> = [];

    for (const p of products) {
      try {
        const senderCost = p.fixedSenderDenominations?.[0] ?? p.minSenderDenomination ?? 0;
        const wholesaleInRewardsCurrency = await this.toWalletCurrency(
          senderCost,
          p.senderCurrencyCode,
          settings.rewardsCurrency,
          undefined,
          p.countryCode,
        );
        const chargedValue = computeRedemptionDebit(wholesaleInRewardsCurrency, feePercentage);
        const pointsCost = Math.ceil(chargedValue * exchangeRate);
        const rawCost = p.fixedSenderDenominations?.[0] ?? p.minSenderDenomination ?? null;
        const rawCurrency = p.senderCurrencyCode;

        records.push({
          productId: p.productId,
          name: p.productName,
          countryCode: p.countryCode,
          currencyCode: p.recipientCurrencyCode,
          imageUrl: p.logoUrls?.[0] ?? null,
          minDenomination: p.minRecipientDenomination ?? null,
          maxDenomination: p.maxRecipientDenomination ?? null,
          fixedDenominations: p.fixedRecipientDenominations ?? [],
          pointsCost,
          listReloadlyCost: rawCost,
          listReloadlyCostCurrency: rawCurrency,
          wholesaleInRewardsCurrency,
        });
      } catch (error) {
        this.logger.warn(
          `Skipping Reloadly product ${p.productId} (${p.productName}): FX conversion failed — ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    const seen = new Set<number>();
    const deduped = records.filter((record) => {
      if (seen.has(record.productId)) {
        return false;
      }
      seen.add(record.productId);
      return true;
    });

    return deduped;
  }

  async getAvailableReloadlyProducts(
    tenantId: string,
  ): Promise<
    Array<NonNullable<RewardsSettings['reloadlyProducts']>[number] & { defaultPointsCost: number }>
  > {
    const settings = await this.getRewardsSettings(tenantId);
    if (!this.reloadlyApi.isConfigured() || settings.catalogCountries.length === 0) {
      return [];
    }

    try {
      const records = await this.buildReloadlyProductRecords(tenantId, settings);
      return records.map((p) => ({
        ...p,
        defaultPointsCost: p.pointsCost,
      }));
    } catch (error) {
      this.logger.warn(
        `Failed to fetch raw Reloadly catalog: ${error instanceof Error ? error.message : error}`,
      );
      return [];
    }
  }

  async claim(tenantId: string, memberId: string, input: ClaimInput): Promise<RewardRedemption> {
    const settings = await this.getRewardsSettings(tenantId);
    if (!settings.enabled) {
      throw new BadRequestException('Rewards are not enabled for this workspace');
    }

    this.assertNgNombaRouting(input, settings);

    const currencyCode = input.currencyCode ?? settings.rewardsCurrency;
    const currencyValue = input.currencyValue;
    const pointsCost = input.pointsCost;

    const redemptionId = randomUUID();

    const { feePercentage } = await this.getSubscriptionFees(tenantId, settings.rewardsCurrency);

    let totalTenantDebit: number;
    let expectedPointsCost: number;
    let faceValueInRewardsCurrency: number;

    if (input.rewardType === 'NOMBA_AIRTIME' || input.rewardType === 'NOMBA_UTILITY') {
      const calc = await this.calculateLocalRewardCost(tenantId, currencyValue);
      totalTenantDebit = calc.totalTenantDebit;
      expectedPointsCost = calc.pointsCost;
      faceValueInRewardsCurrency = calc.currencyValue;
    } else if (input.rewardType === 'RELOADLY') {
      const product = this.resolveReloadlyProduct(settings, input.rewardId);
      if (!product) {
        throw new BadRequestException('Reloadly product not found in catalog');
      }

      let wholesaleInRewardsCurrency = product.wholesaleInRewardsCurrency;
      if (wholesaleInRewardsCurrency == null) {
        if (product.listReloadlyCost == null || !product.listReloadlyCostCurrency) {
          throw new BadRequestException(
            'Gift card pricing is not available. Please refresh the rewards catalog.',
          );
        }
        wholesaleInRewardsCurrency = await this.toWalletCurrency(
          product.listReloadlyCost,
          product.listReloadlyCostCurrency,
          settings.rewardsCurrency,
          undefined,
          product.countryCode,
        );
      }

      faceValueInRewardsCurrency = wholesaleInRewardsCurrency;
      totalTenantDebit = computeRedemptionDebit(wholesaleInRewardsCurrency, feePercentage);
      expectedPointsCost = product.pointsCost;
    } else if (input.rewardType === 'RELOADLY_AIRTIME') {
      const calc = await this.calculateReloadlyAirtimeCost(
        Number(input.billerId),
        currencyValue,
        tenantId,
        settings,
      );
      totalTenantDebit = calc.totalTenantDebit;
      expectedPointsCost = calc.pointsCost;
      faceValueInRewardsCurrency = await this.toWalletCurrency(
        calc.senderAmount,
        calc.senderCurrencyCode,
        settings.rewardsCurrency,
        Number(input.billerId),
      );
    } else if (input.rewardType === 'RELOADLY_UTILITY') {
      const calc = await this.calculateReloadlyUtilityCost(
        Number(input.billerId),
        currencyValue,
        tenantId,
        settings,
      );
      totalTenantDebit = calc.totalTenantDebit;
      expectedPointsCost = calc.pointsCost;
      faceValueInRewardsCurrency = await this.toWalletCurrency(
        calc.senderAmount,
        calc.senderCurrencyCode,
        settings.rewardsCurrency,
        Number(input.billerId),
      );
    } else if (input.rewardType === 'CUSTOM') {
      totalTenantDebit = currencyValue;
      faceValueInRewardsCurrency = currencyValue;
      expectedPointsCost = pointsCost;
    } else {
      throw new BadRequestException(`Unsupported reward type: ${input.rewardType}`);
    }

    if (input.rewardType !== 'CUSTOM' && pointsCost !== expectedPointsCost) {
      throw new BadRequestException(
        `Invalid points cost. Expected ${expectedPointsCost} points for this reward.`,
      );
    }

    let redemption: RewardRedemption;
    await this.dataSource.transaction(async (manager) => {
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
        .set({ currentBalance: () => `current_balance - ${pointsCost}` })
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

      if (input.rewardType !== 'CUSTOM') {
        await this.walletService.debit(
          tenantId,
          totalTenantDebit,
          redemptionId,
          `Reward claim: ${input.rewardName ?? input.rewardId} (Face Value: ${currencyCode} ${currencyValue}, Platform Fees: ${Number((totalTenantDebit - faceValueInRewardsCurrency).toFixed(2))})`,
          manager,
        );
      }

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

    try {
      if (input.rewardType === 'RELOADLY') {
        await this.fulfillReloadly(redemption!, input);
      } else if (input.rewardType === 'NOMBA_AIRTIME') {
        await this.fulfillNombaTopup(redemption!, input);
      } else if (input.rewardType === 'RELOADLY_AIRTIME') {
        await this.fulfillReloadlyAirtime(redemption!, input);
      } else if (input.rewardType === 'NOMBA_UTILITY') {
        await this.fulfillNombaUtility(redemption!, input);
      } else if (input.rewardType === 'RELOADLY_UTILITY') {
        await this.fulfillReloadlyUtility(redemption!, input);
      } else if (input.rewardType === 'CUSTOM') {
        await this.fulfillCustom(redemption!);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown fulfillment error';
      this.logger.error(`Reward fulfillment failed for ${redemptionId}: ${errorMessage}`);

      await this.dataSource.transaction(async (manager) => {
        const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
        await pointsRepo
          .createQueryBuilder()
          .update(ShoutoutMemberPoints)
          .set({ currentBalance: () => `current_balance + ${pointsCost}` })
          .where('tenant_id = :tenantId AND member_id = :memberId', { tenantId, memberId })
          .execute();

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

        if (input.rewardType !== 'CUSTOM') {
          await this.walletService.credit(
            tenantId,
            totalTenantDebit,
            'REFUND',
            redemptionId,
            `Refund: ${input.rewardName ?? input.rewardId}`,
            manager,
          );
        }

        if (input.rewardType === 'CUSTOM') {
          const customRewardRepo = manager.getRepository(CustomReward);
          const cr = await customRewardRepo.findOne({ where: { id: input.rewardId, tenantId } });
          if (cr && cr.stockLimit !== null) {
            await customRewardRepo.update(cr.id, {
              stockLimit: cr.stockLimit + 1,
            });
          }
        }

        const redemptionRepo = manager.getRepository(RewardRedemption);
        await redemptionRepo.update(redemptionId, {
          status: 'FAILED' as RedemptionStatus,
          errorMessage,
        });
      });

      redemption = await this.dataSource.getRepository(RewardRedemption).findOneOrFail({
        where: { id: redemptionId },
      });
      return redemption!;
    }

    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: memberId,
        action: 'reward.redeemed',
        resourceType: 'reward',
        resourceId: redemptionId,
        description: `${input.rewardName ?? input.rewardId} redeemed for ${pointsCost} points`,
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

    return redemption!;
  }

  private async fulfillReloadly(redemption: RewardRedemption, input: ClaimInput): Promise<void> {
    const productId =
      input.providerProductId ??
      (input.rewardId.startsWith('reloadly_')
        ? Number(input.rewardId.replace('reloadly_', ''))
        : undefined);
    if (!productId || !Number.isFinite(productId)) {
      throw new Error('Missing Reloadly productId for gift card order');
    }

    const senderName = await this.resolveSenderName(redemption.tenantId);

    const orderResponse = await this.reloadlyApi.orderGiftCard({
      productId,
      quantity: 1,
      unitPrice: redemption.currencyValue,
      customIdentifier: redemption.id,
      recipientEmail: redemption.recipientEmail ?? undefined,
      senderName,
    });

    const transactionId = orderResponse.transactionId;

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

    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      providerTxRef: transactionId ? String(transactionId) : null,
      voucherCode,
      voucherPin,
      voucherInstructions: 'Present this code at any participating store to redeem.',
    });
  }

  private async fulfillNombaTopup(redemption: RewardRedemption, input: ClaimInput): Promise<void> {
    if (!input.recipientPhone || !input.airtimeNetwork) {
      throw new Error('Phone number and network are required for mobile top-up');
    }

    const senderName = await this.resolveSenderName(redemption.tenantId);
    const purchaseInput = {
      amount: redemption.currencyValue,
      phoneNumber: input.recipientPhone,
      network: input.airtimeNetwork,
      merchantTxRef: redemption.id,
      senderName,
    };

    const isData = input.topupKind === 'data';
    const result = isData
      ? await this.nombaBillApi.purchaseDataBundle(purchaseInput)
      : await this.nombaBillApi.purchaseAirtime(purchaseInput);

    if (!result.success) {
      throw new Error(
        `${isData ? 'Data bundle' : 'Airtime'} purchase failed: status ${result.status}`,
      );
    }

    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      providerTxRef: result.transactionId,
      voucherInstructions: isData
        ? `Data bundle of ${redemption.currencyCode} ${redemption.currencyValue} sent to ${input.recipientPhone}`
        : `Airtime of ${redemption.currencyCode} ${redemption.currencyValue} sent to ${input.recipientPhone}`,
    });
  }

  private async fulfillReloadlyAirtime(
    redemption: RewardRedemption,
    input: ClaimInput,
  ): Promise<void> {
    if (!input.recipientPhone || !input.billerId) {
      throw new Error('Phone number and operatorId are required for Reloadly airtime');
    }

    const cleanedPhone = input.recipientPhone.replace(/^\+/, '');
    const operators = await this.reloadlyTopupsApi.listOperators(input.currencyCode || 'US');
    const op = operators.find((o) => o.operatorId === Number(input.billerId));
    const countryIso = op?.country?.isoName || 'US';

    const result = await this.reloadlyTopupsApi.topup({
      operatorId: Number(input.billerId),
      amount: redemption.currencyValue,
      recipientPhone: {
        countryCode: countryIso,
        number: cleanedPhone,
      },
      customIdentifier: redemption.id,
    });

    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      providerTxRef: String(result.transactionId),
      voucherInstructions: `Airtime recharge of ${redemption.currencyCode} ${redemption.currencyValue} sent to ${input.recipientPhone}`,
    });
  }

  private async fulfillNombaUtility(
    redemption: RewardRedemption,
    input: ClaimInput,
  ): Promise<void> {
    if (!input.accountNumber || !input.billerId || !input.serviceType) {
      throw new Error(
        'Meter number, biller ID, and service type are required for Nomba utility payment',
      );
    }

    const result = await this.nombaBillApi.purchaseElectricity({
      amount: redemption.currencyValue,
      meterNumber: input.accountNumber,
      billerId: String(input.billerId),
      serviceType: input.serviceType as 'PREPAID' | 'POSTPAID',
      merchantTxRef: redemption.id,
    });

    if (!result.success) {
      throw new Error(`Electricity purchase failed: status ${result.status}`);
    }

    const instructions = result.token
      ? `Utility payment successful. Prepaid token: ${result.token}`
      : `Utility payment successful. Reference: ${result.transactionId}`;

    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      providerTxRef: result.transactionId,
      voucherCode: result.token || null,
      voucherInstructions: instructions,
    });
  }

  private async fulfillReloadlyUtility(
    redemption: RewardRedemption,
    input: ClaimInput,
  ): Promise<void> {
    if (!input.accountNumber || !input.billerId) {
      throw new Error(
        'Subscriber account number and biller ID are required for Reloadly utility payment',
      );
    }

    const result = await this.reloadlyUtilitiesApi.payBill({
      subscriberAccountNumber: input.accountNumber,
      amount: redemption.currencyValue,
      billerId: Number(input.billerId),
      useLocalAmount: true,
      referenceId: redemption.id,
    });

    const instructions = result.pin
      ? `Utility payment successful. Pin: ${result.pin}. Code: ${result.code}`
      : `Utility payment successful. Biller: ${result.billerName}`;

    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      providerTxRef: String(result.id),
      voucherCode: result.pin || result.code || null,
      voucherInstructions: instructions,
    });
  }

  async calculateReloadlyAirtimeCost(
    operatorId: number,
    localAmount: number,
    tenantId: string,
    settings: RewardsSettings,
  ): Promise<{
    pointsCost: number;
    currencyValue: number;
    currencyCode: string;
    totalTenantDebit: number;
    senderAmount: number;
    senderCurrencyCode: string;
  }> {
    const fxInfo = await this.reloadlyTopupsApi.getOperatorFxRate(operatorId, localAmount);
    const senderCurrencyCode = 'USD';
    const senderAmount = localAmount / (fxInfo.fxRate || 1);

    const convertedValue = await this.toWalletCurrency(
      localAmount,
      fxInfo.currencyCode,
      settings.rewardsCurrency,
      operatorId,
    );

    const { feePercentage } = await this.getSubscriptionFees(tenantId, settings.rewardsCurrency);
    const totalTenantDebit = computeRedemptionDebit(convertedValue, feePercentage);

    const pointsCost = Math.ceil(totalTenantDebit * settings.pointsExchangeRate);

    return {
      pointsCost,
      currencyValue: localAmount,
      currencyCode: fxInfo.currencyCode,
      totalTenantDebit,
      senderAmount,
      senderCurrencyCode,
    };
  }

  async calculateReloadlyUtilityCost(
    billerId: number,
    localAmount: number,
    tenantId: string,
    settings: RewardsSettings,
  ): Promise<{
    pointsCost: number;
    currencyValue: number;
    currencyCode: string;
    totalTenantDebit: number;
    senderAmount: number;
    senderCurrencyCode: string;
  }> {
    const billers = await this.reloadlyUtilitiesApi.listBillers();
    const biller = billers.find((b) => b.id === billerId);
    if (!biller) {
      throw new BadRequestException('Biller not found');
    }

    const senderCurrencyCode = 'USD';
    const senderAmount = localAmount;

    const operators = await this.reloadlyTopupsApi.listOperators(biller.countryIsoCode);
    const bridgeOperatorId = operators[0]?.operatorId;
    const convertedValue = await this.toWalletCurrency(
      localAmount,
      biller.localTransactionCurrencyCode,
      settings.rewardsCurrency,
      bridgeOperatorId,
    );

    const { feePercentage } = await this.getSubscriptionFees(tenantId, settings.rewardsCurrency);
    const totalTenantDebit = computeRedemptionDebit(convertedValue, feePercentage);

    const pointsCost = Math.ceil(totalTenantDebit * settings.pointsExchangeRate);

    return {
      pointsCost,
      currencyValue: localAmount,
      currencyCode: biller.localTransactionCurrencyCode,
      totalTenantDebit,
      senderAmount,
      senderCurrencyCode,
    };
  }

  private async fulfillCustom(redemption: RewardRedemption): Promise<void> {
    const customReward = await this.dataSource.getRepository(CustomReward).findOne({
      where: { id: redemption.rewardId ?? undefined },
    });

    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      voucherInstructions:
        customReward?.deliveryInstructions ??
        'Your admin has been notified and will fulfill this reward.',
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

  async processNombaFundingPayload(payload: unknown): Promise<{ received: boolean }> {
    const body = payload as {
      event_type?: string;
      eventType?: string;
      event?: string;
      data?: Record<string, unknown>;
    };

    const eventType = String(body.event_type || body.eventType || body.event || '').toLowerCase();

    if (
      !eventType.includes('deposit') &&
      !eventType.includes('virtualaccount') &&
      !eventType.includes('transfer.success')
    ) {
      return { received: true };
    }

    const data = body.data || {};
    const accountNumber = String(
      data.virtualAccount || data.accountNumber || data.virtualAccountNumber || '',
    );
    const amount = Number(data.amount || data.paymentAmount || 0);
    const reference = String(
      data.transactionReference || data.orderReference || data.reference || data.id || '',
    );
    const payloadMeta = body as { requestId?: string };
    const nombaEventId = String(
      data.transactionId || data.id || payloadMeta.requestId || reference || '',
    );
    const payerName = String(
      data.senderName || data.payerName || data.originatorName || data.customerName || '',
    );
    const payerBank = String(data.senderBank || data.bankName || data.originatorBank || '');

    if (!accountNumber || amount <= 0 || !reference) {
      throw new BadRequestException('Invalid webhook payload structure');
    }

    const walletRepo = this.dataSource.getRepository(TenantWallet);
    const wallet = await walletRepo.findOne({
      where: { virtualAccountNumber: accountNumber },
    });
    if (!wallet) {
      const misdirectedRepo = this.dataSource.getRepository(MisdirectedDeposit);
      await misdirectedRepo.save(
        misdirectedRepo.create({
          accountNumber,
          amount,
          reference,
          rawPayload: body as Record<string, unknown>,
        }),
      );
      this.logger.warn(
        `Received deposit webhook for unregistered virtual account: ${accountNumber}`,
      );
      return { received: true };
    }

    const metadata: Record<string, unknown> = {};
    if (payerName) metadata.payerName = payerName;
    if (payerBank) metadata.payerBank = payerBank;

    await this.dataSource.transaction(async (manager) => {
      const txRepo = manager.getRepository(TenantWalletTransaction);
      const existingTx = await txRepo.findOne({
        where: { tenantWalletId: wallet.id, reference },
      });
      if (existingTx) {
        return;
      }

      await this.walletService.credit(
        wallet.tenantId,
        amount,
        'DEPOSIT',
        reference,
        `Bank deposit to virtual account ${accountNumber}`,
        manager,
        {
          rawAmount: amount,
          nombaEventId: nombaEventId || undefined,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          status: 'COMPLETED',
        },
      );
    });

    return { received: true };
  }

  async listTasks(tenantId: string, memberId: string) {
    const taskRepo = this.dataSource.getRepository(Task);
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);

    const tasks = await taskRepo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });

    if (tasks.length === 0) {
      const defaultTasksData: Array<{
        title: string;
        description: string;
        points: number;
        icon: string;
        category?: string;
        imageUrl?: string;
        submissionType: 'instant' | 'text' | 'file';
        isRecurring: boolean;
      }> = [
        {
          title: 'Welcome Tour',
          description: 'Take a quick 2-minute tour of the workspace and navigation.',
          points: 10,
          icon: 'Compass',
          category: 'Onboarding',
          imageUrl:
            'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=150&auto=format&fit=crop&q=60',
          submissionType: 'instant',
          isRecurring: false,
        },
        {
          title: 'Profile Picture Check',
          description: 'Upload your avatar so your teammates can easily recognize you.',
          points: 25,
          icon: 'User',
          category: 'Profile',
          imageUrl:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=60',
          submissionType: 'file',
          isRecurring: false,
        },
        {
          title: 'Spread Appreciation',
          description: 'Recognize a colleague by writing and sending your first shoutout.',
          points: 15,
          icon: 'Heart',
          category: 'Culture',
          imageUrl:
            'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=60',
          submissionType: 'instant',
          isRecurring: false,
        },
        {
          title: 'Daily 10k Steps Challenge',
          description: 'Take 10,000 steps today and upload a screenshot of your tracker.',
          points: 20,
          icon: 'Activity',
          category: 'Health',
          imageUrl:
            'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=150&auto=format&fit=crop&q=60',
          submissionType: 'file',
          isRecurring: true,
        },
        {
          title: 'Share Feedback',
          description: 'Submit your text feedback on what we can improve in this workspace.',
          points: 15,
          icon: 'MessageSquare',
          category: 'Culture',
          imageUrl:
            'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=150&auto=format&fit=crop&q=60',
          submissionType: 'text',
          isRecurring: true,
        },
      ];

      for (const d of defaultTasksData) {
        const t = taskRepo.create({
          tenantId,
          ...d,
        });
        await taskRepo.save(t);
      }

      return this.listTasks(tenantId, memberId);
    }

    const submissions = await submissionRepo.find({
      where: { tenantId, memberId },
    });

    return tasks.map((task) => {
      // Find all submissions for this task, sorted by updatedAt descending
      const taskSubs = submissions
        .filter((s) => s.taskId === task.id)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      const latestSub = taskSubs[0];

      let completed = false;
      let status: 'available' | 'pending' | 'completed' | 'rejected' = 'available';

      if (latestSub) {
        if (latestSub.status === 'completed') {
          if (task.isRecurring) {
            status = 'available';
          } else {
            status = 'completed';
            completed = true;
          }
        } else if (latestSub.status === 'pending') {
          status = 'pending';
        } else if (latestSub.status === 'rejected') {
          status = 'available';
        }
      }

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        points: task.points,
        icon: task.icon,
        category: task.category,
        imageUrl: task.imageUrl,
        submissionType: task.submissionType,
        isRecurring: task.isRecurring,
        completed,
        status,
        submissionText: latestSub?.submissionText,
        submissionFileName: latestSub?.submissionFileName,
        submissionId: latestSub?.id,
      };
    });
  }

  /**
   * Returns whether the given actor is allowed to approve/reject a submission
   * made by `submitterMemberId`.
   *
   * Rules:
   *  - admin/owner: always allowed
   *  - manager (reportsToId on the submitter's current active employment): allowed
   *  - actor === submitter: never allowed
   */
  private async canActorApproveFor(
    tenantId: string,
    actorId: string,
    submitterMemberId: string,
  ): Promise<boolean> {
    // Can never approve your own submission
    if (actorId === submitterMemberId) return false;

    const memberRepo = this.dataSource.getRepository(TenantMember);
    const actor = await memberRepo.findOne({ where: { id: actorId, tenantId } });
    if (!actor) return false;

    const role = actor.role?.toLowerCase();
    if (role === 'admin' || role === 'owner') return true;

    // Check if actor is the line manager of the submitter via Employment.reportsToId
    const employmentRepo = this.dataSource.getRepository(Employment);
    const submitterEmployment = await employmentRepo.findOne({
      where: { tenantMemberId: submitterMemberId, tenantId },
      order: { startDate: 'DESC' },
    });

    if (submitterEmployment?.reportsToId === actorId) return true;

    return false;
  }

  async listPendingSubmissions(tenantId: string, actorId: string) {
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);
    const taskRepo = this.dataSource.getRepository(Task);
    const memberRepo = this.dataSource.getRepository(TenantMember);

    // Determine if actor is admin/owner
    const actor = await memberRepo.findOne({ where: { id: actorId, tenantId } });
    const role = actor?.role?.toLowerCase();
    const isAdminOrOwner = role === 'admin' || role === 'owner';

    const submissions = await submissionRepo.find({
      where: { tenantId, status: 'pending' },
      order: { createdAt: 'DESC' },
    });

    if (submissions.length === 0) return [];

    const tasks = await taskRepo.find({ where: { tenantId } });

    // For non-admin/owner, filter to only submissions the actor manages
    const employmentRepo = this.dataSource.getRepository(Employment);
    let manageableSubmitterIds: Set<string> | null = null;
    if (!isAdminOrOwner) {
      const subordinates = await employmentRepo.find({
        where: { reportsToId: actorId, tenantId },
        select: ['tenantMemberId'],
      });
      manageableSubmitterIds = new Set(subordinates.map((e) => e.tenantMemberId));
    }

    const visibleSubmissions = submissions.filter((sub) => {
      // Never show your own submissions in the approval queue
      if (sub.memberId === actorId) return false;
      // Admins/owners see all
      if (isAdminOrOwner) return true;
      // Managers see only their direct reports
      return manageableSubmitterIds!.has(sub.memberId);
    });

    // Fetch submitter member info
    const submitterIds = [...new Set(visibleSubmissions.map((s) => s.memberId))];
    const members = submitterIds.length ? await memberRepo.findByIds(submitterIds) : [];
    const memberMap = new Map(members.map((m) => [m.id, m]));

    return visibleSubmissions.map((sub) => {
      const task = tasks.find((t) => t.id === sub.taskId);
      const member = memberMap.get(sub.memberId);
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
        member: member ? { firstName: member.firstName, lastName: member.lastName } : undefined,
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
      isRecurring?: boolean;
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
      isRecurring: data.isRecurring ?? false,
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

    if (isInstant) {
      await this.awardPointsForTask(tenantId, memberId, task.points, task.title);
    }

    return {
      success: true,
      status,
      pointsAwarded: isInstant ? task.points : 0,
    };
  }

  async approveSubmission(tenantId: string, taskId: string, submissionId: string, actorId: string) {
    const taskRepo = this.dataSource.getRepository(Task);
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);

    const sub = await submissionRepo.findOne({ where: { id: submissionId, tenantId, taskId } });
    if (!sub) {
      throw new BadRequestException('Submission not found');
    }
    if (sub.status === 'completed') {
      throw new BadRequestException('Submission already approved');
    }

    // Self-approval guard
    if (actorId === sub.memberId) {
      throw new BadRequestException('You cannot approve your own task submission');
    }

    // Permission check: admin/owner or manager of the submitter
    const canApprove = await this.canActorApproveFor(tenantId, actorId, sub.memberId);
    if (!canApprove) {
      throw new BadRequestException(
        'You do not have permission to approve this submission. Only admins, owners, or the direct manager of the employee can approve.',
      );
    }

    const task = await taskRepo.findOne({ where: { id: taskId, tenantId } });
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    sub.status = 'completed';
    await submissionRepo.save(sub);

    await this.awardPointsForTask(tenantId, sub.memberId, task.points, task.title);

    return { success: true };
  }

  async rejectSubmission(tenantId: string, taskId: string, submissionId: string, actorId: string) {
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);

    const sub = await submissionRepo.findOne({ where: { id: submissionId, tenantId, taskId } });
    if (!sub) {
      throw new BadRequestException('Submission not found');
    }

    // Self-rejection guard
    if (actorId === sub.memberId) {
      throw new BadRequestException('You cannot reject your own task submission');
    }

    // Permission check
    const canApprove = await this.canActorApproveFor(tenantId, actorId, sub.memberId);
    if (!canApprove) {
      throw new BadRequestException('You do not have permission to reject this submission.');
    }

    sub.status = 'rejected';
    await submissionRepo.save(sub);

    return { success: true };
  }

  private async awardPointsForTask(
    tenantId: string,
    memberId: string,
    points: number,
    taskTitle: string,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
      const txRepo = manager.getRepository(ShoutoutPointTransaction);
      const shoutoutRepo = manager.getRepository(Shoutout);

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

      // Create a shoutout feed entry so it shows up in the public activity feed
      await shoutoutRepo.save(
        shoutoutRepo.create({
          tenantId,
          totalPoints: points,
          createdBy: memberId,
          message: `completed task: ${taskTitle}`,
        }),
      );
    });
  }

  async listTopupOperators(countryCode: string) {
    return this.reloadlyTopupsApi.listOperators(countryCode);
  }

  async listUtilityBillers(countryCode: string) {
    return this.reloadlyUtilitiesApi.listBillers({ countryISOCode: countryCode });
  }

  async lookupUtilityMeter(
    countryCode: string,
    billerId: string,
    accountNumber: string,
    serviceType?: string,
  ) {
    if (countryCode.toUpperCase() === 'NG') {
      return this.nombaBillApi.lookupElectricity(billerId, accountNumber, serviceType || 'PREPAID');
    }
    return {
      customerName: 'Verified Account',
      meterNumber: accountNumber,
      address: null,
      billerId,
    };
  }

  async calculateLocalRewardCost(
    tenantId: string,
    amount: number,
  ): Promise<{
    pointsCost: number;
    currencyValue: number;
    currencyCode: string;
    totalTenantDebit: number;
    processingFee: number;
  }> {
    const settings = await this.getRewardsSettings(tenantId);
    const { feePercentage } = await this.getSubscriptionFees(tenantId, settings.rewardsCurrency);
    const totalTenantDebit = computeRedemptionDebit(amount, feePercentage);
    const pointsCost = Math.ceil(totalTenantDebit * settings.pointsExchangeRate);

    return {
      pointsCost,
      currencyValue: amount,
      currencyCode: settings.rewardsCurrency,
      totalTenantDebit,
      processingFee: Number((totalTenantDebit - amount).toFixed(2)),
    };
  }

  async calculatePointsCost(
    tenantId: string,
    type: 'airtime' | 'utility' | 'ng-airtime' | 'ng-utility',
    billerId: number,
    amount: number,
  ) {
    if (type === 'ng-airtime' || type === 'ng-utility') {
      return this.calculateLocalRewardCost(tenantId, amount);
    }
    const settings = await this.getRewardsSettings(tenantId);
    if (type === 'airtime') {
      return this.calculateReloadlyAirtimeCost(billerId, amount, tenantId, settings);
    }
    return this.calculateReloadlyUtilityCost(billerId, amount, tenantId, settings);
  }
}
