import { Injectable } from '@nestjs/common';
import { MonnifyAuthService } from './monnify-auth.service';
import { MonnifyCheckoutService } from './monnify-checkout.service';
import { MonnifyDisbursementService } from './monnify-disbursement.service';

export type { MonnifyInitCheckoutInput } from './monnify-checkout.service';
export type { MonnifySingleTransferInput } from './monnify-disbursement.service';

@Injectable()
export class MonnifyApiService {
  constructor(
    private readonly auth: MonnifyAuthService,
    private readonly checkout: MonnifyCheckoutService,
    private readonly disbursement: MonnifyDisbursementService,
  ) {}

  isConfigured(): boolean {
    return this.auth.isConfigured();
  }

  ensureConfigured(): void {
    this.auth.ensureConfigured();
  }

  getAccessToken(): Promise<string> {
    return this.auth.getAccessToken();
  }

  initializeTransaction(input: Parameters<MonnifyCheckoutService['initializeTransaction']>[0]) {
    return this.checkout.initializeTransaction(input);
  }

  verifyTransaction(paymentReference: string, transactionReference?: string) {
    return this.checkout.verifyTransaction(paymentReference, transactionReference);
  }

  chargeCardToken(input: Parameters<MonnifyCheckoutService['chargeCardToken']>[0]) {
    return this.checkout.chargeCardToken(input);
  }

  singleTransfer(input: Parameters<MonnifyDisbursementService['singleTransfer']>[0]) {
    return this.disbursement.singleTransfer(input);
  }

  getDisbursementStatus(reference: string) {
    return this.disbursement.getDisbursementStatus(reference);
  }

  lookupBankAccount(accountNumber: string, bankCode: string) {
    return this.disbursement.lookupBankAccount(accountNumber, bankCode);
  }
}
