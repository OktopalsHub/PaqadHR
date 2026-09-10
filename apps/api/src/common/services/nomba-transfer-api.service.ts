import { Injectable } from '@nestjs/common';
import { verifyNombaWebhookSignature } from '../config/nomba-webhook.util';
import { NombaAuthService } from './nomba-auth.service';
import { NombaTransfersService } from './nomba-transfers.service';

export type {
  NombaBankTransferInput,
  NombaGlobalPayoutInput,
  NombaTransferResponse,
} from './nomba-transfers.service';

@Injectable()
export class NombaTransferApiService {
  constructor(
    private readonly auth: NombaAuthService,
    private readonly transfers: NombaTransfersService,
  ) {}

  isConfigured(): boolean {
    return this.auth.isConfigured();
  }

  getAccessToken(): Promise<string> {
    return this.auth.getAccessToken();
  }

  listBanks() {
    return this.transfers.listBanks();
  }

  lookupBankAccount(accountNumber: string, bankCode: string) {
    return this.transfers.lookupBankAccount(accountNumber, bankCode);
  }

  bankTransfer(input: Parameters<NombaTransfersService['bankTransfer']>[0]) {
    return this.transfers.bankTransfer(input);
  }

  globalPayout(input: Parameters<NombaTransfersService['globalPayout']>[0]) {
    return this.transfers.globalPayout(input);
  }

  getTransactionStatus(reference: string) {
    return this.transfers.getTransactionStatus(reference);
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
    if (
      !eventType.includes('payout') &&
      !eventType.includes('transfer') &&
      !eventType.includes('payment')
    ) {
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

    if (!reference) return null;

    return {
      eventId: data?.transaction?.transactionId || reference,
      reference,
      merchantTxRef,
      status: (data?.status || 'unknown').toUpperCase(),
    };
  }
}
