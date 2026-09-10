import { Injectable } from '@nestjs/common';
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
    return (await this.nombaApi.verifyTransaction(reference)) ?? null;
  }

  requiresProviderVerification(provider: BillingProvider): boolean {
    return provider === BillingProvider.NOMBA || provider === BillingProvider.MONNIFY;
  }
}
