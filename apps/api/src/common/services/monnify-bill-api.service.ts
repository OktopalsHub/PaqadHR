import { Injectable } from '@nestjs/common';
import { MonnifyAirtimeService } from './monnify-airtime.service';
import { MonnifyValidationService } from './monnify-validation.service';

export type { MonnifyAirtimeInput, MonnifyDataPlan } from './monnify-airtime.service';
export type {
  MonnifyBiller,
  MonnifyBillerCategory,
  MonnifyProduct,
  MonnifyTelcoNetwork,
  MonnifyValidateBody,
  MonnifyVendBody,
} from './monnify-validation.service';

@Injectable()
export class MonnifyBillApiService {
  constructor(
    private readonly airtime: MonnifyAirtimeService,
    private readonly validation: MonnifyValidationService,
  ) {}

  isConfigured(): boolean {
    return this.validation.isConfigured();
  }

  listBillerCategories() {
    return this.validation.listBillerCategories();
  }

  listDataPlans(telco: string) {
    return this.airtime.listDataPlans(telco);
  }

  listElectricityBillers() {
    return this.airtime.listElectricityBillers();
  }

  lookupElectricity(billerCode: string, meterNumber: string, serviceType: 'PREPAID' | 'POSTPAID') {
    return this.airtime.lookupElectricity(billerCode, meterNumber, serviceType);
  }

  purchaseAirtime(input: Parameters<MonnifyAirtimeService['purchaseAirtime']>[0]) {
    return this.airtime.purchaseAirtime(input);
  }

  purchaseDataBundle(input: Parameters<MonnifyAirtimeService['purchaseDataBundle']>[0]) {
    return this.airtime.purchaseDataBundle(input);
  }

  purchaseElectricity(input: Parameters<MonnifyAirtimeService['purchaseElectricity']>[0]) {
    return this.airtime.purchaseElectricity(input);
  }
}
