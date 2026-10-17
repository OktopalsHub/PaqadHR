import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { NIGERIAN_BANKS_FALLBACK } from 'src/common/constants/nigerian-banks.constant';
import { PaymentMethodStatus } from 'src/common/enums/payment-method-status.enum';
import { BachsApiError, BachsApiService } from 'src/common/services/bachs-api.service';
import { MonnifyApiService } from 'src/common/services/monnify-api.service';
import { NombaTransferApiService } from 'src/common/services/nomba-transfer-api.service';
import {
  type BankListItem,
  mergeBankLogos,
  monnifyBankCodesToTry,
  nombaBankCodesToTry,
  shouldPreferMonnifyForBankLookup,
} from '../utils/nigerian-bank-lookup.util';

/**
 * Paqad only resolves and pays out Nigerian bank destinations here, so the
 * reference list and the account lookup are both pinned to NG.
 */
const NG_BANK_COUNTRY = 'NG';

@Injectable()
export class NigerianBankService {
  private readonly logger = new Logger(NigerianBankService.name);

  constructor(
    private readonly bachsApi: BachsApiService,
    private readonly nombaTransferApi: NombaTransferApiService,
    private readonly monnifyApi: MonnifyApiService,
  ) {}

  /**
   * Bank list backing the account-lookup dropdown.
   *
   * Bachs `GET /v1/reference/banks` is the default because it is the list Bachs
   * itself pays out to and the code set it expects back when resolving. Monnify,
   * then Nomba, then the static NIP fallback cover a Bachs outage or an
   * unconfigured Bachs key.
   */
  async listBanks(): Promise<BankListItem[]> {
    let primary: BankListItem[] = [];
    let logoSources: BankListItem[] = [];

    if (this.bachsApi.isConfigured()) {
      try {
        const { banks } = await this.bachsApi.listBanks(NG_BANK_COUNTRY);
        primary = banks.map((bank) => ({ code: bank.code, name: bank.name, logoUrl: null }));
      } catch (error) {
        this.logger.warn(
          `Bachs bank list unavailable: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (primary.length === 0 && this.monnifyApi.isConfigured()) {
      try {
        primary = await this.monnifyApi.listBanks();
      } catch (error) {
        this.logger.warn(
          `Monnify bank list unavailable: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (this.nombaTransferApi.isConfigured()) {
      try {
        const nombaBanks = await this.nombaTransferApi.listBanks();
        logoSources = nombaBanks;
        if (primary.length === 0) primary = nombaBanks;
      } catch (error) {
        this.logger.warn(
          `Nomba bank list unavailable: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (primary.length === 0) {
      primary = NIGERIAN_BANKS_FALLBACK.map((bank) => ({
        code: bank.code,
        name: bank.name,
        logoUrl: null,
      }));
    }

    return mergeBankLogos(primary, logoSources).sort((a, b) => a.name.localeCompare(b.name));
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
    const preferMonnify = shouldPreferMonnifyForBankLookup({
      monnifyConfigured: this.monnifyApi.isConfigured(),
    });

    const order: Array<'bachs' | 'monnify' | 'nomba'> = [
      'bachs',
      ...(preferMonnify ? (['monnify', 'nomba'] as const) : (['nomba', 'monnify'] as const)),
    ];

    for (const provider of order) {
      const result =
        provider === 'bachs'
          ? await this.tryBachsLookup(normalized, trimmedCode, bankName)
          : provider === 'monnify'
            ? await this.tryMonnifyLookup(normalized, trimmedCode, bankName)
            : await this.tryNombaLookup(normalized, trimmedCode, bankName);
      if (result) {
        if (provider === 'nomba' && preferMonnify) {
          this.logger.warn(
            'Using Nomba bank lookup fallback — sandbox Nomba may return stub account names',
          );
        }
        return result;
      }
    }

    throw new ServiceUnavailableException('Bank lookup is not available in this environment');
  }

  /**
   * Resolve through Bachs `POST /v1/misc/bank-accounts/resolve`, the same source
   * as the bank list, so the code the user picked is the code we verify against.
   *
   * A `resolved: false` payload is a genuine rejection (wrong number, unsupported
   * country) and throws so the caller surfaces it inline. Transport and
   * auth/provider failures return `null` so the next provider can be tried.
   */
  private async tryBachsLookup(
    accountNumber: string,
    bankCode: string,
    bankName?: string,
  ): Promise<{
    accountNumber: string;
    accountName: string;
    bankCode: string;
    bankName: string;
  } | null> {
    if (!this.bachsApi.isConfigured()) return null;

    let resolution: {
      resolved: boolean;
      accountName: string | null;
      accountNumber: string | null;
      message: string | null;
    };
    try {
      resolution = await this.bachsApi.resolveBankAccount({
        accountNumber,
        bankCode,
        country: NG_BANK_COUNTRY,
      });
    } catch (error) {
      if (
        error instanceof BachsApiError &&
        (error.httpStatus === 400 || error.httpStatus === 404)
      ) {
        throw new BadRequestException(error.message || 'Could not resolve this bank account');
      }
      this.logger.warn(
        `Bachs bank lookup unavailable for bankCode=${bankCode}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }

    const accountName = resolution.accountName?.trim();
    if (resolution.resolved && accountName) {
      return {
        accountNumber: resolution.accountNumber?.trim() || accountNumber,
        accountName,
        bankCode,
        bankName: bankName?.trim() || bankCode,
      };
    }

    throw new BadRequestException(
      resolution.message?.trim() || 'Could not resolve this bank account number',
    );
  }

  private async tryNombaLookup(
    accountNumber: string,
    bankCode: string,
    bankName?: string,
  ): Promise<{
    accountNumber: string;
    accountName: string;
    bankCode: string;
    bankName: string;
  } | null> {
    if (!this.nombaTransferApi.isConfigured()) return null;

    let lastVerifyFailure: BadRequestException | null = null;
    for (const code of nombaBankCodesToTry(bankCode)) {
      try {
        const result = await this.nombaTransferApi.lookupBankAccount(accountNumber, code);
        return {
          ...result,
          bankCode,
          bankName: bankName?.trim() || bankCode,
        };
      } catch (error) {
        if (this.isLookupInfraFailure(error)) {
          this.logger.warn(
            `Nomba lookup unavailable for bankCode=${code}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          return null;
        }
        if (error instanceof BadRequestException) {
          lastVerifyFailure = error;
          continue;
        }
        throw error;
      }
    }
    if (lastVerifyFailure) throw lastVerifyFailure;
    return null;
  }

  private async tryMonnifyLookup(
    accountNumber: string,
    bankCode: string,
    bankName?: string,
  ): Promise<{
    accountNumber: string;
    accountName: string;
    bankCode: string;
    bankName: string;
  } | null> {
    if (!this.monnifyApi.isConfigured()) return null;

    let lastVerifyFailure: BadRequestException | null = null;
    let sawInfraFailure = false;

    for (const code of monnifyBankCodesToTry(bankCode)) {
      try {
        const result = await this.monnifyApi.lookupBankAccount(accountNumber, code);
        return {
          ...result,
          bankCode,
          bankName: bankName?.trim() || bankCode,
        };
      } catch (error) {
        if (this.isLookupInfraFailure(error)) {
          sawInfraFailure = true;
          this.logger.warn(
            `Monnify lookup unavailable for bankCode=${code}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          continue;
        }
        if (error instanceof BadRequestException) {
          lastVerifyFailure = error;
          this.logger.warn(`Monnify lookup rejected bankCode=${code}: ${error.message}`);
          continue;
        }
        throw error;
      }
    }

    if (lastVerifyFailure) throw lastVerifyFailure;
    if (sawInfraFailure) return null;
    return null;
  }

  private isLookupInfraFailure(error: unknown): boolean {
    return (
      error instanceof ServiceUnavailableException ||
      (error instanceof BadRequestException &&
        /not available|not configured|unavailable|Failed to authenticate with Nomba|Failed to authenticate with Monnify/i.test(
          error.message || '',
        ))
    );
  }
}
