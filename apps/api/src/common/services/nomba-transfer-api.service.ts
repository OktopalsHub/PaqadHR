import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  getNombaAccountId,
  getNombaBaseUrl,
  getNombaClientId,
  getNombaClientSecret,
  getNombaPayoutAuthCode,
  getNombaSubAccountId,
  isNombaConfigured,
} from '../config/nomba.config';
import { isNombaAcceptedCode, resolveNombaTokenExpiresAtMs } from '../config/nomba-api.util';
import { verifyNombaWebhookSignature } from '../config/nomba-webhook.util';

interface NombaTokenResponse {
  code?: string;
  data?: { access_token?: string; expires_in?: number; expiresAt?: string; expires_at?: string };
}

interface NombaTransferResponse {
  code?: string;
  description?: string;
  data?: {
    id?: string;
    status?: string;
    amount?: number;
    meta?: { merchantTxRef?: string };
  };
}

interface NombaBanksResponse {
  code?: string;
  data?:
    | {
        results?: Array<{ code: string; name: string }>;
      }
    | Array<{ code: string; name: string }>;
}

interface NombaBankLookupResponse {
  code?: string;
  description?: string;
  data?: {
    accountNumber?: string;
    accountName?: string;
  };
}

export interface NombaBankTransferInput {
  amount: number;
  accountNumber: string;
  accountName: string;
  bankCode: string;
  merchantTxRef: string;
  senderName: string;
  narration?: string;
}

export interface NombaGlobalPayoutInput {
  amount: number;
  sourceCurrency: string;
  destinationCurrency: string;
  receiverName: string;
  sourceCountryIsoCode: string;
  destinationCountryIsoCode: string;
  paymentMethod: string;
  accountNumber: string;
  institutionCode?: string;
  institutionName?: string;
  accountType?: 'INDIVIDUAL' | 'CORPORATE';
  bankAccountType?: 'CHECKING' | 'SAVINGS';
  purposeOfPayment?: string;
  narration?: string;
  merchantTxRef: string;
}

@Injectable()
export class NombaTransferApiService {
  private readonly logger = new Logger(NombaTransferApiService.name);
  private cachedToken?: { token: string; expiresAt: number };
  private cachedBanks?: { fetchedAt: number; banks: Array<{ code: string; name: string }> };
  private static readonly BANKS_CACHE_MS = 24 * 60 * 60 * 1000;

  isConfigured(): boolean {
    return isNombaConfigured();
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException('Nomba payout is not configured');
    }
  }

  public async getAccessToken(): Promise<string> {
    this.ensureConfigured();

    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.token;
    }

    const response = await fetch(`${getNombaBaseUrl()}/v1/auth/token/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accountId: getNombaAccountId(),
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: getNombaClientId(),
        client_secret: getNombaClientSecret(),
      }),
    });

    let payload: NombaTokenResponse;
    try {
      payload = (await response.json()) as NombaTokenResponse;
    } catch {
      throw new BadRequestException('Failed to authenticate with Nomba: invalid JSON response');
    }

    const token = payload.data?.access_token;
    if (!response.ok || (payload.code && !isNombaAcceptedCode(payload.code)) || !token) {
      throw new BadRequestException(`Failed to authenticate with Nomba (${response.status})`);
    }

    this.cachedToken = { token, expiresAt: resolveNombaTokenExpiresAtMs(payload.data) };
    return token;
  }

  private async request<T>(
    path: string,
    body: Record<string, unknown>,
    options?: { idempotentKey?: string },
  ): Promise<T> {
    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      accountId: getNombaAccountId(),
    };
    if (options?.idempotentKey) {
      headers['X-Idempotent-key'] = options.idempotentKey;
    }
    const response = await fetch(`${getNombaBaseUrl()}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      let message = `Nomba request failed (${response.status})`;
      try {
        const errorPayload = JSON.parse(responseText) as {
          message?: string;
          description?: string;
        };
        if (errorPayload && typeof errorPayload === 'object') {
          message = errorPayload.message || errorPayload.description || message;
        }
      } catch {}
      this.logger.error(`Nomba ${path} failed: ${message}`);
      throw new BadRequestException(`Nomba payout error: ${message}`);
    }

    let payload: T & { code?: string; description?: string };
    try {
      payload = JSON.parse(responseText) as T & { code?: string; description?: string };
    } catch {
      throw new BadRequestException('Nomba payout error: invalid JSON response');
    }

    if (payload.code !== undefined && !isNombaAcceptedCode(payload.code)) {
      throw new BadRequestException(
        payload.description || `Nomba payout error: code ${payload.code}`,
      );
    }

    return payload;
  }

  async listBanks(): Promise<Array<{ code: string; name: string }>> {
    if (
      this.cachedBanks &&
      Date.now() - this.cachedBanks.fetchedAt < NombaTransferApiService.BANKS_CACHE_MS
    ) {
      return this.cachedBanks.banks;
    }

    this.ensureConfigured();
    const token = await this.getAccessToken();
    const response = await fetch(`${getNombaBaseUrl()}/v1/transfers/banks`, {
      headers: {
        Authorization: `Bearer ${token}`,
        accountId: getNombaAccountId(),
      },
    });

    const payload = (await response.json()) as NombaBanksResponse;
    if (!response.ok || (payload.code !== undefined && !isNombaAcceptedCode(payload.code))) {
      throw new BadRequestException('Failed to fetch bank list from Nomba');
    }

    const rows = Array.isArray(payload.data) ? payload.data : (payload.data?.results ?? []);
    const banks = rows.slice().sort((a, b) => a.name.localeCompare(b.name));
    this.cachedBanks = { fetchedAt: Date.now(), banks };
    return banks;
  }

  async lookupBankAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<{ accountNumber: string; accountName: string }> {
    const payload = await this.request<NombaBankLookupResponse>('/v1/transfers/bank/lookup', {
      accountNumber,
      bankCode,
    });

    if (!isNombaAcceptedCode(payload.code) || !payload.data?.accountName) {
      throw new BadRequestException('Could not verify this bank account');
    }

    return {
      accountNumber: payload.data.accountNumber ?? accountNumber,
      accountName: payload.data.accountName,
    };
  }

  private singleTransactionPath(reference: string): string {
    const subAccountId = getNombaSubAccountId();
    // Checkout orders use orderReference; Nomba txn IDs use transactionRef.
    const looksLikeTxnId =
      reference.startsWith('WEB-') ||
      reference.startsWith('API-') ||
      reference.includes('TRANSFER') ||
      reference.includes('ONLINE_C');
    const query = looksLikeTxnId
      ? `transactionRef=${encodeURIComponent(reference)}`
      : `orderReference=${encodeURIComponent(reference)}`;
    return subAccountId
      ? `/v1/transactions/accounts/${encodeURIComponent(subAccountId)}/single?${query}`
      : `/v1/transactions/accounts/single?${query}`;
  }

  async bankTransfer(input: NombaBankTransferInput): Promise<NombaTransferResponse> {
    const subAccountId = getNombaSubAccountId();
    const path = subAccountId
      ? `/v2/transfers/bank/${encodeURIComponent(subAccountId)}`
      : '/v2/transfers/bank';
    return this.request<NombaTransferResponse>(
      path,
      {
        amount: input.amount,
        accountNumber: input.accountNumber,
        accountName: input.accountName,
        bankCode: input.bankCode,
        merchantTxRef: input.merchantTxRef,
        senderName: input.senderName,
        narration: input.narration ?? 'Payroll disbursement',
      },
      { idempotentKey: input.merchantTxRef },
    );
  }

  async globalPayout(input: NombaGlobalPayoutInput): Promise<NombaTransferResponse> {
    const authCode = getNombaPayoutAuthCode();
    if (!authCode) {
      throw new BadRequestException('NOMBA_PAYOUT_AUTH_CODE is required for non-NGN fiat payouts');
    }

    return this.request<NombaTransferResponse>(
      '/v1/global-payout/transfer/authorize',
      {
        amount: input.amount,
        sourceCurrency: input.sourceCurrency,
        destinationCurrency: input.destinationCurrency,
        receiverName: input.receiverName,
        sourceCountryIsoCode: input.sourceCountryIsoCode,
        destinationCountryIsoCode: input.destinationCountryIsoCode,
        authCode,
        paymentMethod: input.paymentMethod,
        accountNumber: input.accountNumber,
        institutionCode: input.institutionCode,
        institutionName: input.institutionName,
        accountType: input.accountType ?? 'INDIVIDUAL',
        bankAccountType: input.bankAccountType,
        purposeOfPayment: input.purposeOfPayment ?? 'PAYROLL',
        narration: input.narration ?? 'Payroll disbursement',
        meta: { merchantTxRef: input.merchantTxRef },
      },
      { idempotentKey: input.merchantTxRef },
    );
  }

  async getTransactionStatus(reference: string): Promise<string | null> {
    this.ensureConfigured();
    try {
      const token = await this.getAccessToken();
      const response = await fetch(`${getNombaBaseUrl()}${this.singleTransactionPath(reference)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          accountId: getNombaAccountId(),
        },
      });
      const payload = (await response.json()) as { data?: { status?: string } };
      if (!response.ok) return null;
      return payload.data?.status ?? null;
    } catch {
      return null;
    }
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    return verifyNombaWebhookSignature(rawBody, signature);
  }

  parseTransferWebhook(payload: unknown): {
    eventId: string;
    reference: string;
    merchantTxRef?: string;
    status: string;
  } | null {
    const body = payload as {
      event_type?: string;
      eventType?: string;
      data?: {
        id?: string;
        status?: string;
        orderReference?: string;
        meta?: { merchantTxRef?: string };
        order?: { orderReference?: string; orderMetaData?: Record<string, string> };
        transaction?: { transactionId?: string; merchantTxRef?: string };
      };
    };

    const eventType = (body.event_type || body.eventType || '').toLowerCase();
    if (!eventType.includes('transfer') && !eventType.includes('payment')) {
      return null;
    }

    const data = body.data;
    const reference =
      data?.id ??
      data?.orderReference ??
      data?.order?.orderReference ??
      data?.transaction?.transactionId;
    const merchantTxRef =
      data?.meta?.merchantTxRef ??
      data?.transaction?.merchantTxRef ??
      data?.order?.orderMetaData?.merchantTxRef;

    if (!reference) {
      return null;
    }

    return {
      eventId: data?.transaction?.transactionId || reference,
      reference,
      merchantTxRef,
      status: (data?.status || 'unknown').toUpperCase(),
    };
  }
}
