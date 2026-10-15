import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../../enums/payment-provider.enum';
import type {
  PayoutStatusQuerier,
  PayoutStatusResult,
} from '../../interfaces/payout-status-querier.interface';
import { NombaTransferApiService } from '../../services/nomba-transfer-api.service';

@Injectable()
export class NombaPayoutQuerierAdapter implements PayoutStatusQuerier {
  readonly provider = PaymentProvider.NOMBA;

  constructor(private readonly nombaTransferApi: NombaTransferApiService) {}

  async queryStatus(transactionId: string): Promise<PayoutStatusResult | null> {
    const status = await this.nombaTransferApi.getTransactionStatus(transactionId);
    if (!status) return null;
    return { status };
  }
}
