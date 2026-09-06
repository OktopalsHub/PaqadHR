import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../../enums/payment-provider.enum';
import type {
  PayoutStatusQuerier,
  PayoutStatusResult,
} from '../../interfaces/payout-status-querier.interface';
import { MonnifyApiService } from '../../services/monnify-api.service';

@Injectable()
export class MonnifyPayoutQuerierAdapter implements PayoutStatusQuerier {
  readonly provider = PaymentProvider.MONNIFY;

  constructor(private readonly monnifyApi: MonnifyApiService) {}

  async queryStatus(transactionId: string): Promise<PayoutStatusResult | null> {
    const result = await this.monnifyApi.getDisbursementStatus(transactionId);
    if (!result?.status) return null;
    return {
      status: result.status,
      amount: result.amount,
      reference: result.reference,
    };
  }
}
