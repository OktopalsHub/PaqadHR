import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { NIGERIAN_BANKS_FALLBACK } from 'src/common/constants/nigerian-banks.constant';
import { PaymentMethodStatus } from 'src/common/enums/payment-method-status.enum';
import { MonnifyApiService } from 'src/common/services/monnify-api.service';
import { NombaTransferApiService } from 'src/common/services/nomba-transfer-api.service';

@Injectable()
export class NigerianBankService {
  private readonly logger = new Logger(NigerianBankService.name);

  constructor(
    private readonly nombaTransferApi: NombaTransferApiService,
    private readonly monnifyApi: MonnifyApiService,
  ) {}

  async listBanks(): Promise<Array<{ code: string; name: string }>> {
    if (this.nombaTransferApi.isConfigured()) {
      try {
        return await this.nombaTransferApi.listBanks();
      } catch (e) {
        this.logger.warn(`Nomba bank list unavailable: ${e instanceof Error ? e.message : e}`);
      }
    }
    return [...NIGERIAN_BANKS_FALLBACK].sort((a, b) => a.name.localeCompare(b.name));
  }

  async resolveBankAccount(
    accountNumber: string,
    bankCode: string,
    bankName?: string,
    manualAccountName?: string,
  ): Promise<{
    accountName: string;
    bankName?: string;
    status: PaymentMethodStatus;
    verifiedAt: Date | null;
  }> {
    try {
      const lookup = await this.lookupBankAccount(accountNumber, bankCode, bankName);
      return {
        accountName: lookup.accountName,
        bankName: lookup.bankName,
        status: PaymentMethodStatus.VERIFIED,
        verifiedAt: new Date(),
      };
    } catch (error) {
      const lookupDown =
        error instanceof ServiceUnavailableException ||
        (error instanceof BadRequestException &&
          /not available|not configured|unavailable|Failed to authenticate with Nomba/i.test(
            error.message || '',
          ));
      if (lookupDown && manualAccountName?.trim())
        return {
          accountName: manualAccountName.trim(),
          bankName: bankName?.trim() || undefined,
          status: PaymentMethodStatus.DRAFT,
          verifiedAt: null,
        };
      throw error;
    }
  }

  async lookupBankAccount(
    accountNumber: string,
    bankCode: string,
    bankName?: string,
  ): Promise<{ accountNumber: string; accountName: string; bankCode: string; bankName: string }> {
    const normalized = accountNumber.replace(/\D/g, '');
    if (normalized.length !== 10) throw new BadRequestException('Account number must be 10 digits');
    if (!bankCode?.trim()) throw new BadRequestException('Bank is required');
    const trimmedCode = bankCode.trim();

    if (this.nombaTransferApi.isConfigured()) {
      try {
        const r = await this.nombaTransferApi.lookupBankAccount(normalized, trimmedCode);
        return { ...r, bankCode: trimmedCode, bankName: bankName?.trim() || trimmedCode };
      } catch (e) {
        if (
          !(
            e instanceof ServiceUnavailableException ||
            (e instanceof BadRequestException &&
              /not available|not configured|unavailable|Failed to authenticate with Nomba/i.test(
                e.message || '',
              ))
          )
        )
          throw e;
        this.logger.warn(
          `Nomba lookup failed, trying Monnify: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    if (this.monnifyApi.isConfigured()) {
      try {
        const r = await this.monnifyApi.lookupBankAccount(normalized, trimmedCode);
        return { ...r, bankCode: trimmedCode, bankName: bankName?.trim() || trimmedCode };
      } catch (e) {
        if (
          !(
            e instanceof ServiceUnavailableException ||
            (e instanceof BadRequestException &&
              /not available|not configured|unavailable/i.test(e.message || ''))
          )
        )
          throw e;
        this.logger.warn(`Monnify lookup failed: ${e instanceof Error ? e.message : e}`);
      }
    }
    throw new ServiceUnavailableException('Bank lookup is not available in this environment');
  }
}
