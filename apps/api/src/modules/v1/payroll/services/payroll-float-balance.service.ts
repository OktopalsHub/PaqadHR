import { Injectable, Logger } from '@nestjs/common';
import { getMonnifyBaseUrl, getMonnifyWalletAccountNumber } from 'src/common/config/monnify.config';
import {
  getNombaAccountId,
  getNombaBaseUrl,
  getNombaSubAccountId,
} from 'src/common/config/nomba.config';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { FincraAuthService } from 'src/common/services/fincra-auth.service';
import { MonnifyAuthService } from 'src/common/services/monnify-auth.service';
import { NombaAuthService } from 'src/common/services/nomba-auth.service';

export type PayrollFloatBalanceResult =
  | { supported: true; available: number; currency: string }
  | { supported: false; reason: string };

@Injectable()
export class PayrollFloatBalanceService {
  private readonly logger = new Logger(PayrollFloatBalanceService.name);

  constructor(
    private readonly nombaAuth: NombaAuthService,
    private readonly monnifyAuth: MonnifyAuthService,
    private readonly fincraAuth: FincraAuthService,
  ) {}

  async getAvailableBalance(
    provider: PaymentProvider,
    currency: string,
  ): Promise<PayrollFloatBalanceResult> {
    const code = currency.toUpperCase();
    try {
      switch (provider) {
        case PaymentProvider.NOMBA:
          return await this.getNombaBalance(code);
        case PaymentProvider.MONNIFY:
          return await this.getMonnifyBalance(code);
        case PaymentProvider.FINCRA:
          return await this.getFincraBalance(code);
        default:
          return {
            supported: false,
            reason:
              'Balance lookup is not available for this payout provider. Fund it in the provider dashboard.',
          };
      }
    } catch (error) {
      this.logger.warn(
        `Payroll float balance lookup failed for ${provider}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        supported: false,
        reason: 'Could not read provider balance. Fund the payout account, then retry.',
      };
    }
  }

  providerDashboardUrl(provider: PaymentProvider): string {
    switch (provider) {
      case PaymentProvider.NOMBA:
        return 'https://dashboard.nomba.com';
      case PaymentProvider.MONNIFY:
        return 'https://app.monnify.com';
      case PaymentProvider.FINCRA:
        return 'https://dashboard.fincra.com';
      case PaymentProvider.NOAH:
        return 'https://dashboard.noah.com';
      default:
        return '';
    }
  }

  /** Hosted checkout that credits the same merchant float used for payouts. */
  supportsHostedFloatTopup(provider: PaymentProvider): boolean {
    return provider === PaymentProvider.NOMBA || provider === PaymentProvider.FINCRA;
  }

  private async getNombaBalance(currency: string): Promise<PayrollFloatBalanceResult> {
    if (!this.nombaAuth.isConfigured()) {
      return { supported: false, reason: 'Nomba is not configured' };
    }
    const token = await this.nombaAuth.getAccessToken();
    const subAccountId = getNombaSubAccountId();
    // Parent: GET /v1/accounts/balance. Sub: GET /v1/accounts/{subAccountId}/balance.
    // GET /v1/accounts/{parentId} returns 403 on sandbox.
    const path = subAccountId
      ? `/v1/accounts/${encodeURIComponent(subAccountId)}/balance`
      : '/v1/accounts/balance';
    const response = await fetch(`${getNombaBaseUrl()}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        accountId: getNombaAccountId(),
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Nomba account lookup failed (${response.status})`);
    }
    const parsed = text
      ? (JSON.parse(text) as {
          data?: {
            amount?: number | string;
            availableBalance?: number | string;
            balance?: number | string;
            currency?: string;
          };
        })
      : {};
    const raw = parsed.data?.amount ?? parsed.data?.availableBalance ?? parsed.data?.balance;
    const available = Number(raw);
    if (!Number.isFinite(available)) {
      return { supported: false, reason: 'Nomba balance response was incomplete' };
    }
    return {
      supported: true,
      available,
      currency: (parsed.data?.currency || currency).toUpperCase(),
    };
  }

  private async getMonnifyBalance(currency: string): Promise<PayrollFloatBalanceResult> {
    if (!this.monnifyAuth.isConfigured()) {
      return { supported: false, reason: 'Monnify is not configured' };
    }
    const accountNumber = getMonnifyWalletAccountNumber();
    if (!accountNumber) {
      return {
        supported: false,
        reason: 'MONNIFY_WALLET_ACCOUNT_NUMBER is not configured',
      };
    }
    const token = await this.monnifyAuth.getAccessToken();
    const url = `${getMonnifyBaseUrl()}/api/v2/disbursements/wallet-balance?accountNumber=${encodeURIComponent(accountNumber)}`;
    const response = await this.monnifyAuth.monnifyFetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Monnify wallet balance failed (${response.status})`);
    }
    const parsed = text
      ? (JSON.parse(text) as {
          responseBody?: { availableBalance?: number | string; balance?: number | string };
        })
      : {};
    const raw = parsed.responseBody?.availableBalance ?? parsed.responseBody?.balance;
    const available = Number(raw);
    if (!Number.isFinite(available)) {
      return { supported: false, reason: 'Monnify balance response was incomplete' };
    }
    return { supported: true, available, currency: currency.toUpperCase() };
  }

  private async getFincraBalance(currency: string): Promise<PayrollFloatBalanceResult> {
    // Fincra requires businessID as a query param (header alone returns 422).
    const businessId = await this.fincraAuth.resolveBusinessId();
    const { parsed, httpStatus } = await this.fincraAuth.request<
      | Array<{ currency?: string; availableBalance?: number | string; balance?: number | string }>
      | { currency?: string; availableBalance?: number | string; balance?: number | string }
    >('GET', `/wallets?businessID=${encodeURIComponent(businessId)}`, undefined, {
      includeBusinessId: true,
    });

    if (httpStatus >= 400) {
      throw new Error(`Fincra wallets failed (${httpStatus})`);
    }

    const rows = Array.isArray(parsed.data) ? parsed.data : parsed.data ? [parsed.data] : [];
    const match =
      rows.find((row) => (row.currency || '').toUpperCase() === currency.toUpperCase()) ?? rows[0];
    if (!match) {
      return { supported: false, reason: 'No Fincra wallet found for this currency' };
    }
    const available = Number(match.availableBalance ?? match.balance);
    if (!Number.isFinite(available)) {
      return { supported: false, reason: 'Fincra balance response was incomplete' };
    }
    return {
      supported: true,
      available,
      currency: (match.currency || currency).toUpperCase(),
    };
  }
}
