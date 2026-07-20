import { BadRequestException, Injectable } from '@nestjs/common';
import {
  isBillingProviderConfigured,
  resolveBillingProviderForCountry,
} from '../config/billing-provider-resolver';
import { BillingProvider } from '../constants/billing-provider.enum';
import { BachsSubscriptionProvider } from '../providers/bachs-subscription.provider';
import { NombaSubscriptionProvider } from '../providers/nomba-subscription.provider';
import { PolarSubscriptionProvider } from '../providers/polar-subscription.provider';
import type { ISubscriptionBillingProvider } from '../providers/subscription-billing-provider.interface';

@Injectable()
export class BillingProviderFactoryService {
  constructor(
    private readonly nombaProvider: NombaSubscriptionProvider,
    private readonly bachsProvider: BachsSubscriptionProvider,
    private readonly polarProvider: PolarSubscriptionProvider,
  ) {}

  resolveBillingProvider(countryCode: string | null | undefined): BillingProvider {
    return resolveBillingProviderForCountry(countryCode);
  }

  /** @deprecated Use resolveBillingProvider(countryCode) — currency-only routing is removed */
  resolveBillingProviderByCurrency(currency: string): BillingProvider {
    return resolveBillingProviderForCountry(currency.toUpperCase() === 'NGN' ? 'NG' : 'GLOBAL');
  }

  getProviderForCountry(countryCode: string | null | undefined): ISubscriptionBillingProvider {
    return this.getProviderByEnum(this.resolveBillingProvider(countryCode));
  }

  /** @deprecated Use getProviderForCountry */
  getProvider(currency: string): ISubscriptionBillingProvider {
    return this.getProviderForCountry(currency.toUpperCase() === 'NGN' ? 'NG' : 'GLOBAL');
  }

  getProviderByEnum(provider: BillingProvider): ISubscriptionBillingProvider {
    switch (provider) {
      case BillingProvider.NOMBA:
        return this.nombaProvider;
      case BillingProvider.BACHS:
        return this.bachsProvider;
      case BillingProvider.POLAR:
        return this.polarProvider;
      default:
        return this.nombaProvider;
    }
  }

  ensureConfigured(countryCode: string | null | undefined): void {
    const provider = this.resolveBillingProvider(countryCode);
    if (!isBillingProviderConfigured(provider)) {
      throw new BadRequestException(`${provider} subscription billing is not configured`);
    }
    const billingProvider = this.getProviderByEnum(provider);
    billingProvider.ensureConfigured?.();
  }

  getNombaProvider(): NombaSubscriptionProvider {
    return this.nombaProvider;
  }

  getBachsProvider(): BachsSubscriptionProvider {
    return this.bachsProvider;
  }

  getPolarProvider(): PolarSubscriptionProvider {
    return this.polarProvider;
  }

  async cancelExternalSubscription(
    provider: BillingProvider,
    externalSubscriptionId: string,
    atPeriodEnd = false,
  ): Promise<void> {
    const billingProvider = this.getProviderByEnum(provider);
    if (!billingProvider.cancelExternalSubscription) {
      return;
    }
    await billingProvider.cancelExternalSubscription(externalSubscriptionId, {
      atPeriodEnd,
    });
  }
}
