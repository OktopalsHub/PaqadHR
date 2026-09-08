import { BadRequestException, Injectable } from '@nestjs/common';
import { getMonnifyBaseUrl, getMonnifyWalletAccountNumber } from '../config/monnify.config';
import { MonnifyAuthService } from './monnify-auth.service';

interface MonnifyDisbursementResponse {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
  responseBody?: {
    amount?: number;
    reference?: string;
    status?: string;
    totalFee?: number;
    transactionDescription?: string;
  };
}

export interface MonnifySingleTransferInput {
  amount: number;
  reference: string;
  narration: string;
  destinationBankCode: string;
  destinationAccountNumber: string;
  destinationAccountName: string;
  currencyCode?: string;
}

@Injectable()
export class MonnifyDisbursementService {
  constructor(private readonly auth: MonnifyAuthService) {}

  async singleTransfer(input: MonnifySingleTransferInput): Promise<{
    success: boolean;
    reference: string;
    status?: string;
    message?: string;
  }> {
    this.auth.ensureConfigured();
    const sourceAccountNumber = getMonnifyWalletAccountNumber();
    if (!sourceAccountNumber) {
      throw new BadRequestException('MONNIFY_WALLET_ACCOUNT_NUMBER is not configured');
    }

    const token = await this.auth.getAccessToken();
    const response = await this.auth.monnifyFetch(
      `${getMonnifyBaseUrl()}/api/v2/disbursements/single`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: input.amount,
          reference: input.reference,
          narration: input.narration,
          destinationBankCode: input.destinationBankCode,
          destinationAccountNumber: input.destinationAccountNumber,
          destinationAccountName: input.destinationAccountName,
          currency: (input.currencyCode || 'NGN').toUpperCase(),
          sourceAccountNumber,
        }),
      },
    );

    const payload = (await response.json().catch(() => ({}))) as MonnifyDisbursementResponse;
    const body = payload.responseBody;
    const status = body?.status?.toUpperCase();
    const success =
      response.ok &&
      payload.requestSuccessful === true &&
      Boolean(body?.reference) &&
      status != null &&
      ['SUCCESS', 'SUCCESSFUL', 'PENDING', 'PROCESSING'].includes(status);

    return {
      success,
      reference: body?.reference ?? input.reference,
      status,
      message: payload.responseMessage,
    };
  }

  async getDisbursementStatus(
    reference: string,
  ): Promise<{ status: string | null; amount?: number; reference?: string }> {
    this.auth.ensureConfigured();
    const token = await this.auth.getAccessToken();
    const url = `${getMonnifyBaseUrl()}/api/v2/disbursements/single/summary?reference=${encodeURIComponent(reference)}`;
    const response = await this.auth.monnifyFetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await response.json().catch(() => ({}))) as MonnifyDisbursementResponse & {
      responseBody?: {
        status?: string;
        amount?: number;
        reference?: string;
        transactionStatus?: string;
      };
    };
    if (!response.ok || payload.requestSuccessful === false) {
      return { status: null };
    }
    const body = payload.responseBody;
    const status = String(body?.status ?? body?.transactionStatus ?? '').toUpperCase();
    return {
      status: status || null,
      amount: body?.amount != null ? Number(body.amount) : undefined,
      reference: body?.reference ?? reference,
    };
  }

  async lookupBankAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<{ accountNumber: string; accountName: string }> {
    this.auth.ensureConfigured();
    const token = await this.auth.getAccessToken();
    const url = `${getMonnifyBaseUrl()}/api/v2/disbursements/account/validate?accountNumber=${encodeURIComponent(accountNumber)}&bankCode=${encodeURIComponent(bankCode)}`;
    const response = await this.auth.monnifyFetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await response.json().catch(() => ({}))) as {
      requestSuccessful?: boolean;
      responseMessage?: string;
      responseBody?: {
        accountNumber?: string;
        accountName?: string;
      };
    };
    if (!response.ok || payload.requestSuccessful === false || !payload.responseBody?.accountName) {
      this.auth.logMonnifyResponse(
        'lookup-bank-account',
        '/api/v2/disbursements/account/validate',
        response.status,
        payload,
        { accountNumber: `****${accountNumber.slice(-4)}` },
      );
      throw new BadRequestException('Could not verify this bank account');
    }
    return {
      accountNumber: payload.responseBody.accountNumber ?? accountNumber,
      accountName: payload.responseBody.accountName,
    };
  }
}
