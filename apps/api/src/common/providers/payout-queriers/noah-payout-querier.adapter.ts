import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../../enums/payment-provider.enum';
import type {
  PayoutStatusQuerier,
  PayoutStatusResult,
} from '../../interfaces/payout-status-querier.interface';
import { NoahApiService } from '../../services/noah-api.service';

@Injectable()
export class NoahPayoutQuerierAdapter implements PayoutStatusQuerier {
  readonly provider = PaymentProvider.NOAH;

  constructor(private readonly noahApi: NoahApiService) {}

  async queryStatus(transactionId: string): Promise<PayoutStatusResult | null> {
    const result = await this.noahApi.verifyTransaction(transactionId);
    if (!result) return null;
    return {
      status: result.status?.toUpperCase() ?? 'unknown',
      amount: result.amount != null ? Number(result.amount) : undefined,
    };
  }
}
