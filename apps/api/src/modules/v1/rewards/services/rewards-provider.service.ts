import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { resolveNgRewardsAirtimeProvider } from 'src/common/utils/ng-money-provider.util';
import { MonnifyBillApiService } from 'src/common/services/monnify-bill-api.service';
import { NombaBillApiService } from 'src/common/services/nomba-bill-api.service';
import { TremendousApiService } from 'src/common/services/tremendous-api.service';
import type { RewardsSettings } from 'src/common/interfaces/rewards-settings.interface';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';

@Injectable()
export class RewardsProviderService {
  private readonly logger = new Logger(RewardsProviderService.name);

  constructor(
    private readonly nombaBillApi: NombaBillApiService,
    private readonly monnifyBillApi: MonnifyBillApiService,
    private readonly tremendousApi: TremendousApiService,
  ) {}

  useMonnifyNgBills(): boolean {
    return resolveNgRewardsAirtimeProvider() === PaymentProvider.MONNIFY;
  }

  assertNgNombaRouting(input: { rewardType: string; currencyCode?: string }, settings: RewardsSettings): void {
    if (input.rewardType === 'NOMBA_AIRTIME' || input.rewardType === 'NOMBA_UTILITY') {
      const configured = this.useMonnifyNgBills()
        ? this.monnifyBillApi.isConfigured()
        : this.nombaBillApi.isConfigured();
      if (!configured) {
        throw new BadRequestException('Nigeria redemptions are temporarily unavailable.');
      }
    }
  }

  async getProviderAvailability() {
    return {
      tremendous: {
        giftCards: this.tremendousApi.isConfigured(),
      },
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
      if (!this.monnifyBillApi.isConfigured()) {
        throw new BadRequestException('Data plans are temporarily unavailable.');
      }
      const plans = await this.monnifyBillApi.listDataPlans(network);
      return plans.map(({ amount, plan }) => ({ amount, plan }));
    }
    if (!this.nombaBillApi.isConfigured()) {
      throw new BadRequestException('Data plans are temporarily unavailable.');
    }
    return this.nombaBillApi.listDataPlans(network);
  }

  async listUtilityBillers(countryCode: string) {
    if (countryCode.toUpperCase() === 'NG') {
      if (this.useMonnifyNgBills()) {
        if (!this.monnifyBillApi.isConfigured()) {
          throw new BadRequestException('Utility billers are temporarily unavailable.');
        }
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
      if (this.useMonnifyNgBills()) {
        return this.monnifyBillApi.lookupElectricity(billerId, accountNumber, service);
      }
      return this.nombaBillApi.lookupElectricity(billerId, accountNumber, service);
    }
    return {
      customerName: 'Verified Account',
      meterNumber: accountNumber,
      address: null,
      billerId,
    };
  }

  isTremendousConfigured(): boolean {
    return this.tremendousApi.isConfigured();
  }
}
