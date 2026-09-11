import { Injectable } from '@nestjs/common';
import { parseNombaAmount } from '../../../../common/config/nomba-api.util';
import { MonnifyApiService } from '../../../../common/services/monnify-api.service';
import { BillingProvider } from '../constants/billing-provider.enum';
import { NombaApiService } from './nomba-api.service';

@Injectable()
export class PaymentVerifier {
  constructor(
    private readonly monnifyApi: MonnifyApiService,
    private readonly nombaApi: NombaApiService,
  ) {}

  async verifyPaymentReference(
    reference: string,
    provider: BillingProvider,
  ): Promise<{ status?: string; paid?: boolean; amount?: number } | null> {
    if (provider === BillingProvider.MONNIFY) return this.monnifyApi.verifyTransaction(reference);
    if (provider !== BillingProvider.NOMBA) return { status: 'success', amount: 0 };

    const verified = await this.nombaApi.verifyTransaction(reference);
    if (!verified) return null;

    return {
      status: verified.status,
      amount: parseNombaAmount(verified.amount),
    };
  }

  requiresProviderVerification(provider: BillingProvider): boolean {
    return provider === BillingProvider.NOMBA || provider === BillingProvider.MONNIFY;
  }
}
