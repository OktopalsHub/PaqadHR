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

export interface MonnifyBatchTransferLine extends MonnifySingleTransferInput {}

interface MonnifyBatchDisbursementResponse {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
  responseBody?: {
    batchReference?: string;
    status?: string;
    totalAmount?: number;
    totalFee?: number;
    transactionList?: Array<{
      reference?: string;
      amount?: number;
      status?: string;
      transactionDescription?: string;
    }>;
  };
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

  async batchTransfer(input: {
    title: string;
    batchReference: string;
    narration: string;
    transactions: MonnifyBatchTransferLine[];
  }): Promise<
    Array<{
      success: boolean;
      reference: string;
      status?: string;
      message?: string;
    }>
  > {
    this.auth.ensureConfigured();
    const sourceAccountNumber = getMonnifyWalletAccountNumber();
    if (!sourceAccountNumber) {
      throw new BadRequestException('MONNIFY_WALLET_ACCOUNT_NUMBER is not configured');
    }
    if (input.transactions.length === 0) {
      return [];
    }

    const token = await this.auth.getAccessToken();
    const response = await this.auth.monnifyFetch(
      `${getMonnifyBaseUrl()}/api/v2/disbursements/batch`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: input.title.slice(0, 100),
          batchReference: input.batchReference,
          narration: input.narration.slice(0, 100),
          sourceAccountNumber,
          onValidationFailure: 'CONTINUE',
          notificationInterval: 50,
          transactionList: input.transactions.map((tx) => ({
            amount: tx.amount,
            reference: tx.reference,
            narration: tx.narration,
            destinationBankCode: tx.destinationBankCode,
            destinationAccountNumber: tx.destinationAccountNumber,
            destinationAccountName: tx.destinationAccountName,
            currency: (tx.currencyCode || 'NGN').toUpperCase(),
          })),
        }),
      },
    );

    const payload = (await response.json().catch(() => ({}))) as MonnifyBatchDisbursementResponse;
    const lines = payload.responseBody?.transactionList ?? [];
    const byRef = new Map(
      lines
        .filter((line) => line.reference)
        .map((line) => [String(line.reference), line] as const),
    );

    const accepted =
      response.ok &&
      payload.requestSuccessful === true &&
      ['SUCCESS', 'SUCCESSFUL', 'PENDING', 'PROCESSING', 'IN_PROGRESS', 'AWAITING_PROCESSING'].includes(
        String(payload.responseBody?.status ?? 'PENDING').toUpperCase(),
      );

    return input.transactions.map((tx) => {
      const line = byRef.get(tx.reference);
      const status = String(line?.status ?? payload.responseBody?.status ?? 'PENDING').toUpperCase();
      const success =
        accepted &&
        !['FAILED', 'FAILED_TRANSACTION', 'REVERSED', 'CANCELLED'].includes(status);
      return {
        success,
        reference: tx.reference,
        status,
        message: success ? undefined : payload.responseMessage || line?.transactionDescription,
      };
    });
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
