import { isBachsConfigured } from 'src/common/config/bachs.config';
import { isMonnifyConfigured } from 'src/common/config/monnify.config';
import { isNombaConfigured } from 'src/common/config/nomba.config';
import { isPolarConfigured } from 'src/common/config/polar.config';
import { BillingProvider } from '../constants/billing-provider.enum';
import { BillingRegion } from '../constants/billing-region.enum';

/** Nigeria: Nomba default; Monnify or Bachs when configured via env. */
const NG_ALLOWLIST: BillingProvider[] = [
  BillingProvider.NOMBA,
  BillingProvider.MONNIFY,
  BillingProvider.BACHS,
];
/** Global: Nomba default for now; Bachs/Polar when explicitly configured. */
const GLOBAL_ALLOWLIST: BillingProvider[] = [
  BillingProvider.NOMBA,
  BillingProvider.BACHS,
  BillingProvider.POLAR,
];

function parseProvider(value: string | undefined): BillingProvider | null {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === BillingProvider.NOMBA ||
    normalized === BillingProvider.MONNIFY ||
    normalized === BillingProvider.BACHS ||
    normalized === BillingProvider.POLAR
  ) {
    return normalized;
  }
  return null;
}

export function getBillingNgProvider(): BillingProvider {
  return parseProvider(process.env.BILLING_NG_PROVIDER) ?? BillingProvider.NOMBA;
}

export function getBillingGlobalProvider(): BillingProvider {
  return parseProvider(process.env.BILLING_GLOBAL_PROVIDER) ?? BillingProvider.NOMBA;
}

export function isBillingProviderConfigured(provider: BillingProvider): boolean {
  switch (provider) {
    case BillingProvider.BACHS:
      return isBachsConfigured();
    case BillingProvider.NOMBA:
      return isNombaConfigured();
    case BillingProvider.MONNIFY:
      return isMonnifyConfigured();
    case BillingProvider.POLAR:
      return isPolarConfigured();
    default:
      return false;
  }
}

export function resolveBillingRegion(countryCode: string | null | undefined): BillingRegion {
  return countryCode?.trim().toUpperCase() === BillingRegion.NG
    ? BillingRegion.NG
    : BillingRegion.GLOBAL;
}

export function resolveBillingProviderForCountry(
  countryCode: string | null | undefined,
): BillingProvider {
  const region = resolveBillingRegion(countryCode);
  const preferred =
    region === BillingRegion.NG ? getBillingNgProvider() : getBillingGlobalProvider();
  const allowlist = region === BillingRegion.NG ? NG_ALLOWLIST : GLOBAL_ALLOWLIST;

  if (allowlist.includes(preferred) && isBillingProviderConfigured(preferred)) {
    return preferred;
  }

  for (const candidate of allowlist) {
    if (isBillingProviderConfigured(candidate)) {
      return candidate;
    }
  }

  return preferred;
}

export function isAnyBillingProviderConfigured(): boolean {
  return isNombaConfigured() || isMonnifyConfigured() || isBachsConfigured() || isPolarConfigured();
}
