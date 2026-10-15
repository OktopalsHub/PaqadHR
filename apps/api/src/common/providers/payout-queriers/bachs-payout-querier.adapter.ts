import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider } from '../../enums/payment-provider.enum';
import type {
  PayoutStatusQuerier,
  PayoutStatusResult,
} from '../../interfaces/payout-status-querier.interface';
import { BachsApiService } from '../../services/bachs-api.service';

@Injectable()
export class BachsPayoutQuerierAdapter implements PayoutStatusQuerier {
  readonly provider = PaymentProvider.BACHS;
  private readonly logger = new Logger(BachsPayoutQuerierAdapter.name);

  constructor(private readonly bachsApi: BachsApiService) {}

  async queryStatus(
    transactionId: string,
    merchantRef?: string,
  ): Promise<PayoutStatusResult | null> {
    if (!transactionId?.trim()) return null;
    try {
      const payout = await this.bachsApi.getPayout(transactionId);
      if (!payout) return null;
      // Payout.amount is the amount delivered, denominated in the destination currency —
      // the same basis as PayrollItem.paymentAmount.
      const amount =
        payout.amount != null && payout.amount.trim() !== '' ? Number(payout.amount) : undefined;
      return {
        status: payout.status ?? 'pending',
        amount: Number.isFinite(amount as number) ? (amount as number) : undefined,
        reference: payout.reference ?? merchantRef,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Bachs payout status lookup failed for ${transactionId}: ${message}`);
      return null;
    }
  }
}
