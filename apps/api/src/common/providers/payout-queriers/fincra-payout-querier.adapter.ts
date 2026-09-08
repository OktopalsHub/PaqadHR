import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../../enums/payment-provider.enum';
import type {
  PayoutStatusQuerier,
  PayoutStatusResult,
} from '../../interfaces/payout-status-querier.interface';
import { FincraApiService } from '../../services/fincra-api.service';

@Injectable()
export class FincraPayoutQuerierAdapter implements PayoutStatusQuerier {
  readonly provider = PaymentProvider.FINCRA;

  constructor(private readonly fincraApi: FincraApiService) {}

  async queryStatus(
    transactionId: string,
    merchantRef?: string,
  ): Promise<PayoutStatusResult | null> {
    const ref = merchantRef ?? transactionId;
    const result = await this.fincraApi.getPayoutStatus(ref);
    if (!result) return null;
    return {
      status: result.status,
      amount: result.amount,
      reference: result.reference,
    };
  }
}
