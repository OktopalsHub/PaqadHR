import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { MonnifyBillApiService } from 'src/common/services/monnify-bill-api.service';
import { NombaBillApiService } from 'src/common/services/nomba-bill-api.service';
import { TremendousApiService } from 'src/common/services/tremendous-api.service';
import { resolveNgRewardsAirtimeProvider } from 'src/common/utils/ng-money-provider.util';
import { DataSource } from 'typeorm';
import { RewardRedemption } from '../entities/reward-redemption.entity';
import { RewardsCatalogService } from './rewards-catalog.service';
import { type ClaimInput, RewardsClaimService } from './rewards-claim.service';
import { RewardsTaskService } from './rewards-task.service';

export type { CatalogItem } from './rewards-catalog.service';
export type { ClaimInput } from './rewards-claim.service';

@Injectable()
export class RewardsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly catalogService: RewardsCatalogService,
    private readonly claimService: RewardsClaimService,
    private readonly taskService: RewardsTaskService,
    private readonly nombaBillApi: NombaBillApiService,
    private readonly monnifyBillApi: MonnifyBillApiService,
    private readonly tremendousApi: TremendousApiService,
  ) {}

  private useMonnifyNgBills(): boolean {
    return resolveNgRewardsAirtimeProvider() === PaymentProvider.MONNIFY;
  }

  async getCatalog(
    tenantId: string,
    options?: { includeAdminPricing?: boolean; countryCode?: string | null },
  ) {
    return this.catalogService.getCatalog(tenantId, options);
  }
  async syncCatalog(tenantId: string, options?: { force?: boolean }) {
    return this.catalogService.syncCatalog(tenantId, options);
  }
  async getCatalogCountries(tenantId: string) {
    return this.catalogService.getCatalogCountries(tenantId);
  }
  async claim(tenantId: string, memberId: string, input: ClaimInput): Promise<RewardRedemption> {
    return this.claimService.claim(tenantId, memberId, input);
  }
  async getMyClaims(tenantId: string, memberId: string): Promise<RewardRedemption[]> {
    return this.dataSource
      .getRepository(RewardRedemption)
      .find({ where: { tenantId, memberId }, order: { createdAt: 'DESC' }, take: 50 });
  }
  async getAllClaims(tenantId: string) {
    return this.dataSource.getRepository(RewardRedemption).find({
      where: { tenantId },
      relations: ['member'],
      order: { createdAt: 'DESC' },
      take: 100,
      select: {
        id: true,
        tenantId: true,
        memberId: true,
        rewardId: true,
        rewardName: true,
        rewardType: true,
        pointsSpent: true,
        currencyValue: true,
        currencyCode: true,
        status: true,
        providerRef: true,
        recipient: true,
        createdAt: true,
        updatedAt: true,
        processingStartedAt: true,
        member: { id: true, firstName: true, lastName: true, preferredName: true },
      },
    });
  }
  async refundStaleClaim(redemption: RewardRedemption) {
    return this.claimService.refundStaleClaim(redemption);
  }
  async getSubscriptionFees(tenantId: string, currency: string) {
    return this.claimService.getSubscriptionFees(tenantId, currency);
  }
  async getRedemptionFees(tenantId: string, currency: string) {
    return this.claimService.getRedemptionFees(tenantId, currency);
  }
  async calculatePointsCost(
    tenantId: string,
    type: string,
    billerId: string | number,
    amount: number,
  ) {
    return this.claimService.calculatePointsCost(tenantId, type, billerId, amount);
  }
  async listTasks(tenantId: string, memberId: string) {
    return this.taskService.listTasks(tenantId, memberId);
  }
  async listPendingSubmissions(tenantId: string, actorId: string) {
    return this.taskService.listPendingSubmissions(tenantId, actorId);
  }
  async createTask(
    tenantId: string,
    data: Parameters<RewardsTaskService['createTask']>[1],
    actorMemberId?: string,
  ) {
    return this.taskService.createTask(tenantId, data, actorMemberId);
  }
  async updateTask(
    tenantId: string,
    taskId: string,
    data: Parameters<RewardsTaskService['updateTask']>[2],
    actorMemberId?: string,
  ) {
    return this.taskService.updateTask(tenantId, taskId, data, actorMemberId);
  }
  async deleteTask(tenantId: string, taskId: string, actorMemberId?: string) {
    return this.taskService.deleteTask(tenantId, taskId, actorMemberId);
  }
  async submitTask(
    tenantId: string,
    taskId: string,
    memberId: string,
    data: Parameters<RewardsTaskService['submitTask']>[3],
  ) {
    return this.taskService.submitTask(tenantId, taskId, memberId, data);
  }
  async approveSubmission(tenantId: string, taskId: string, submissionId: string, actorId: string) {
    return this.taskService.approveSubmission(tenantId, taskId, submissionId, actorId);
  }
  async rejectSubmission(tenantId: string, taskId: string, submissionId: string, actorId: string) {
    return this.taskService.rejectSubmission(tenantId, taskId, submissionId, actorId);
  }

  async getProviderAvailability() {
    return {
      tremendous: { giftCards: this.tremendousApi.isConfigured() },
      nomba: {
        airtime: this.nombaBillApi.isConfigured(),
        utility: this.nombaBillApi.isConfigured(),
      },
      monnify: {
        airtime: this.monnifyBillApi.isConfigured(),
        utility: this.monnifyBillApi.isConfigured(),
      },
    };
  }

  async listNombaDataPlans(network: string) {
    if (this.useMonnifyNgBills()) {
      if (!this.monnifyBillApi.isConfigured())
        throw new BadRequestException('Data plans are temporarily unavailable.');
      const plans = await this.monnifyBillApi.listDataPlans(network);
      return plans.map(({ amount, plan, productCode }) => ({ amount, plan, productCode }));
    }
    if (!this.nombaBillApi.isConfigured())
      throw new BadRequestException('Data plans are temporarily unavailable.');
    return this.nombaBillApi.listDataPlans(network);
  }

  async listUtilityBillers(countryCode: string) {
    if (countryCode.toUpperCase() === 'NG') {
      if (this.useMonnifyNgBills()) {
        if (!this.monnifyBillApi.isConfigured())
          throw new BadRequestException('Utility billers are temporarily unavailable.');
        return this.monnifyBillApi.listElectricityBillers();
      }
      return [
        { id: 'EKEDC', name: 'Eko Electricity (EKEDC)' },
        { id: 'IKEDC', name: 'Ikeja Electricity (IKEDC)' },
        { id: 'AEDC', name: 'Abuja Electricity (AEDC)' },
        { id: 'IBEDC', name: 'Ibadan Electricity (IBEDC)' },
        { id: 'PHEDC', name: 'Port Harcourt Electricity (PHEDC)' },
        { id: 'KEDCO', name: 'Kano Electricity (KEDCO)' },
        { id: 'JED', name: 'Jos Electricity (JED)' },
        { id: 'EEDC', name: 'Enugu Electricity (EEDC)' },
        { id: 'KAEDCO', name: 'Kaduna Electricity (KAEDCO)' },
        { id: 'BEDC', name: 'Benin Electricity (BEDC)' },
        { id: 'YEDC', name: 'Yola Electricity (YEDC)' },
      ];
    }
    return [];
  }

  async lookupUtilityMeter(
    countryCode: string,
    billerId: string,
    accountNumber: string,
    serviceType?: string,
  ) {
    if (countryCode.toUpperCase() === 'NG') {
      const service = (serviceType || 'PREPAID') as 'PREPAID' | 'POSTPAID';
      return this.useMonnifyNgBills()
        ? this.monnifyBillApi.lookupElectricity(billerId, accountNumber, service)
        : this.nombaBillApi.lookupElectricity(billerId, accountNumber, service);
    }
    return {
      customerName: 'Verified Account',
      meterNumber: accountNumber,
      address: null,
      billerId,
    };
  }
}
