import { BadRequestException, Injectable } from '@nestjs/common';
import {
  isBillingProviderConfigured,
  resolveBillingProviderForCountry,
} from '../config/billing-provider-resolver';
import { BillingProvider } from '../constants/billing-provider.enum';
import { BachsSubscriptionProvider } from '../providers/bachs-subscription.provider';
import { MonnifySubscriptionProvider } from '../providers/monnify-subscription.provider';
import { NombaSubscriptionProvider } from '../providers/nomba-subscription.provider';
import { PolarSubscriptionProvider } from '../providers/polar-subscription.provider';
import type { ISubscriptionBillingProvider } from '../providers/subscription-billing-provider.interface';

@Injectable()
export class BillingProviderFactoryService {
  constructor(
    private readonly nombaProvider: NombaSubscriptionProvider,
    private readonly monnifyProvider: MonnifySubscriptionProvider,
    private readonly bachsProvider: BachsSubscriptionProvider,
    private readonly polarProvider: PolarSubscriptionProvider,
  ) {}

  resolveBillingProvider(countryCode: string | null | undefined): BillingProvider {
    return resolveBillingProviderForCountry(countryCode);
  }

  getProviderForCountry(countryCode: string | null | undefined): ISubscriptionBillingProvider {
    return this.getProviderByEnum(this.resolveBillingProvider(countryCode));
  }

  getProviderByEnum(provider: BillingProvider): ISubscriptionBillingProvider {
    switch (provider) {
      case BillingProvider.NOMBA:
        return this.nombaProvider;
      case BillingProvider.MONNIFY:
        return this.monnifyProvider;
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

  async resumeExternalSubscription(
    provider: BillingProvider,
    externalSubscriptionId: string,
  ): Promise<void> {
    const billingProvider = this.getProviderByEnum(provider);
    if (!billingProvider.resumeExternalSubscription) {
      throw new BadRequestException(
        `Undo cancellation is not supported for ${provider} subscriptions`,
      );
    }
    await billingProvider.resumeExternalSubscription(externalSubscriptionId);
  }
}
