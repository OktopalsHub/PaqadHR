import { Injectable, Logger } from '@nestjs/common';
import {
  getNombaAccountId,
  getNombaBaseUrl,
  getNombaSubAccountId,
} from 'src/common/config/nomba.config';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { NombaAuthService } from 'src/common/services/nomba-auth.service';

export type PayrollFloatBalanceResult =
  | { supported: true; available: number; currency: string }
  | { supported: false; reason: string };

@Injectable()
export class PayrollFloatBalanceService {
  private readonly logger = new Logger(PayrollFloatBalanceService.name);

  constructor(private readonly nombaAuth: NombaAuthService) {}

  async getAvailableBalance(
    provider: PaymentProvider,
    currency: string,
  ): Promise<PayrollFloatBalanceResult> {
    const code = currency.toUpperCase();
    try {
      switch (provider) {
        case PaymentProvider.NOMBA:
          return await this.getNombaBalance(code);
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
      default:
        return '';
    }
  }

  /** Hosted checkout that credits the same merchant float used for payouts. */
  supportsHostedFloatTopup(provider: PaymentProvider): boolean {
    return provider === PaymentProvider.NOMBA;
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
}
