import { Injectable } from '@nestjs/common';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { resolvePaymentProvider } from 'src/common/utils/resolve-payment-provider.util';
import { BillingProvider } from '../constants/billing-provider.enum';
import { NoahSubscriptionProvider } from '../providers/noah-subscription.provider';
import { NombaSubscriptionProvider } from '../providers/nomba-subscription.provider';
import type { ISubscriptionBillingProvider } from '../providers/subscription-billing-provider.interface';

@Injectable()
export class BillingProviderFactoryService {
  constructor(
    private readonly nombaProvider: NombaSubscriptionProvider,
    private readonly noahProvider: NoahSubscriptionProvider,
  ) {}

  resolveBillingProvider(currency: string): BillingProvider {
    return resolvePaymentProvider(currency) === PaymentProvider.NOMBA
      ? BillingProvider.NOMBA
      : BillingProvider.NOAH;
  }

  getProvider(currency: string): ISubscriptionBillingProvider {
    return this.resolveBillingProvider(currency) === BillingProvider.NOMBA
      ? this.nombaProvider
      : this.noahProvider;
  }

  getProviderByEnum(provider: BillingProvider): ISubscriptionBillingProvider {
    return provider === BillingProvider.NOMBA ? this.nombaProvider : this.noahProvider;
  }

  ensureConfigured(currency: string): void {
    const provider = this.getProvider(currency);
    if (!provider.ensureConfigured) {
      return;
    }
    provider.ensureConfigured();
  }

  getNombaProvider(): NombaSubscriptionProvider {
    return this.nombaProvider;
  }

  getNoahProvider(): NoahSubscriptionProvider {
    return this.noahProvider;
  }
}
