import { Injectable, Logger } from '@nestjs/common';

/**
 * Handles bank listing and account lookup.
 */
@Injectable()
export class PaymentMethodBankService {
  private readonly logger = new Logger(PaymentMethodBankService.name);

  async listBanks(countryCode?: string) {
    // TODO: Extract from payment-method.service.ts
    return [];
  }

  async lookupBankAccount(bankCode: string, accountNumber: string) {
    // TODO: Extract from payment-method.service.ts
    return { accountName: null, bankName: null };
  }

  async validateGlobalBank(countryCode: string, bankCode: string) {
    // TODO: Extract from payment-method.service.ts
    return { valid: false, message: null };
  }
}
