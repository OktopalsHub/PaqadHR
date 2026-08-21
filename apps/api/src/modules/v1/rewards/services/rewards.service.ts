import { Injectable, Logger } from '@nestjs/common';
import type { RewardsSettings } from 'src/common/interfaces/rewards-settings.interface';
import type { CatalogItem, ClaimInput } from '../interfaces/rewards.interface';
import { RewardsCatalogService } from './rewards-catalog.service';
import { RewardsRedemptionService } from './rewards-redemption.service';
import { RewardsTasksService } from './rewards-tasks.service';
import { RewardsFeeService } from './rewards-fee.service';
import { RewardsProviderService } from './rewards-provider.service';
import { RewardsPointsService } from './rewards-points.service';
import type { RewardRedemption } from '../entities/reward-redemption.entity';

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    private readonly catalogService: RewardsCatalogService,
    private readonly redemptionService: RewardsRedemptionService,
    private readonly tasksService: RewardsTasksService,
    private readonly feeService: RewardsFeeService,
    private readonly providerService: RewardsProviderService,
    private readonly pointsService: RewardsPointsService,
  ) {}

  async getCatalog(
    tenantId: string,
    options?: { includeAdminPricing?: boolean; countryCode?: string | null },
  ): Promise<CatalogItem[]> {
    return this.catalogService.getCatalog(tenantId, options);
  }

  async syncCatalog(
    tenantId: string,
    options?: { force?: boolean },
  ): Promise<{ providers: Array<'tremendous'>; count: number }> {
    return this.catalogService.syncCatalog(tenantId, options);
  }

  async getCatalogCountries(tenantId: string): Promise<Array<{ code: string; name: string }>> {
    return this.catalogService.getCatalogCountries(tenantId);
  }

  async claim(tenantId: string, memberId: string, input: ClaimInput): Promise<RewardRedemption> {
    const { settings } = await this.catalogService.getRewardsContext(tenantId);
    if (!settings.enabled) {
      throw new Error('Rewards are not enabled for this workspace');
    }
    this.providerService.assertNgNombaRouting(input, settings);
    return this.redemptionService.claim(tenantId, memberId, input, settings);
  }

  async getMyClaims(tenantId: string, memberId: string): Promise<RewardRedemption[]> {
    return this.redemptionService.getMyClaims(tenantId, memberId);
  }

  async getAllClaims(tenantId: string): Promise<RewardRedemption[]> {
    return this.redemptionService.getAllClaims(tenantId);
  }

  async listTasks(tenantId: string, memberId: string) {
    return this.tasksService.listTasks(tenantId, memberId);
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
    actorMemberId?: string,
  ) {
    return this.tasksService.createTask(tenantId, data, actorMemberId);
  }

  async deleteTask(tenantId: string, taskId: string, actorMemberId?: string) {
    return this.tasksService.deleteTask(tenantId, taskId, actorMemberId);
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
    return this.tasksService.submitTask(tenantId, taskId, memberId, data);
  }

  async approveSubmission(tenantId: string, taskId: string, submissionId: string, actorId: string) {
    return this.tasksService.approveSubmission(tenantId, taskId, submissionId, actorId);
  }

  async rejectSubmission(tenantId: string, taskId: string, submissionId: string, actorId: string) {
    return this.tasksService.rejectSubmission(tenantId, taskId, submissionId, actorId);
  }

  async listPendingSubmissions(tenantId: string, actorId: string) {
    return this.tasksService.listPendingSubmissions(tenantId, actorId);
  }

  async getSubscriptionFees(
    tenantId: string,
    walletCurrency: string,
  ): Promise<{ feePercentage: number; flatFee: number }> {
    return this.feeService.getSubscriptionFees(tenantId, walletCurrency);
  }

  async getRedemptionFees(tenantId: string, currency: string) {
    return this.feeService.getRedemptionFees(tenantId, currency);
  }

  async getProviderAvailability() {
    return this.providerService.getProviderAvailability();
  }

  async listNombaDataPlans(network: string) {
    return this.providerService.listNombaDataPlans(network);
  }

  async listUtilityBillers(countryCode: string) {
    return this.providerService.listUtilityBillers(countryCode);
  }

  async lookupUtilityMeter(
    countryCode: string,
    billerId: string,
    accountNumber: string,
    serviceType?: string,
  ) {
    return this.providerService.lookupUtilityMeter(countryCode, billerId, accountNumber, serviceType);
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
    const { settings } = await this.catalogService.getRewardsContext(tenantId);
    return this.pointsService.calculateLocalRewardCost(tenantId, amount, settings.pointsExchangeRate);
  }

  async calculatePointsCost(
    tenantId: string,
    type: 'airtime' | 'utility' | 'ng-airtime' | 'ng-utility',
    _billerId: number,
    amount: number,
  ) {
    if (type === 'ng-airtime' || type === 'ng-utility') {
      return this.calculateLocalRewardCost(tenantId, amount);
    }
    throw new Error('Global airtime and utility rewards are not available.');
  }

  async syncTremendousProducts(
    tenantId: string,
    options?: { force?: boolean },
  ): Promise<NonNullable<RewardsSettings['tremendousProducts']>> {
    return this.catalogService.syncTremendousProducts(tenantId, options);
  }
}
