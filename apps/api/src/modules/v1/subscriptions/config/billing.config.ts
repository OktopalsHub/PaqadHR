import {
  isAnyBillingProviderConfigured,
  isBillingProviderConfigured,
  resolveBillingProviderForCountry,
} from './billing-provider-resolver';

export function isFeatureGatingEnabled(): boolean {
  return true;
}

export function isBillingGatewayEnabled(): boolean {
  return isAnyBillingProviderConfigured();
}

export function isBillingGatewayEnabledForCountry(countryCode: string | null | undefined): boolean {
  const provider = resolveBillingProviderForCountry(countryCode);
  return isBillingProviderConfigured(provider);
}

export function assertBillingGatewayAllowed(countryCode?: string | null): void {
  if (!isBillingGatewayEnabledForCountry(countryCode ?? 'GLOBAL')) {
    throw new Error(
      'Billing is not configured for this region. Set provider credentials (Nomba, Bachs, or Polar).',
    );
  }
}
