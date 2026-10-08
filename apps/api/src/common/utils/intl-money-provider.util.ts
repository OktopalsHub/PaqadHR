import { isBachsConfigured } from '../config/bachs.config';
import { isFincraConfigured } from '../config/fincra.config';
import { isNoahConfigured } from '../config/noah.config';
import { PaymentProvider } from '../enums/payment-provider.enum';

export type IntlMoneyProvider = 'noah' | 'fincra' | 'bachs';

function readEnvFirst(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim().toLowerCase();
    if (value) return value;
  }
  return undefined;
}

/** International payroll + stablecoin payouts. Canonical: INTL_PAYROLL_PROVIDER. */
export function getIntlPayrollProviderPreference(): IntlMoneyProvider {
  const normalized = readEnvFirst('INTL_PAYROLL_PROVIDER');
  if (normalized === 'fincra') return 'fincra';
  if (normalized === 'bachs') return 'bachs';
  return 'noah';
}

/** Non-NGN rewards wallet deposit checkout. Canonical: INTL_REWARDS_DEPOSIT_PROVIDER. */
export function getIntlRewardsDepositProviderPreference(): 'noah' | 'fincra' {
  const normalized = readEnvFirst('INTL_REWARDS_DEPOSIT_PROVIDER');
  // Wallet checkout stays on Noah/Fincra — Bachs intl wallet deposit is not a payroll rail.
  return normalized === 'fincra' ? 'fincra' : 'noah';
}

function resolveNoahOrFincra(preferred: 'noah' | 'fincra'): PaymentProvider {
  if (preferred === 'fincra') {
    if (isFincraConfigured()) {
      return PaymentProvider.FINCRA;
    }
    if (isNoahConfigured()) {
      return PaymentProvider.NOAH;
    }
    return PaymentProvider.FINCRA;
  }

  if (isNoahConfigured()) {
    return PaymentProvider.NOAH;
  }
  if (isFincraConfigured()) {
    return PaymentProvider.FINCRA;
  }
  return PaymentProvider.NOAH;
}

export function resolveIntlPaymentProvider(): PaymentProvider {
  const preferred = getIntlPayrollProviderPreference();
  if (preferred === 'bachs') {
    if (isBachsConfigured()) return PaymentProvider.BACHS;
    return resolveNoahOrFincra('noah');
  }
  return resolveNoahOrFincra(preferred);
}

/**
 * Crypto that Bachs cannot deliver (e.g. Ethereum USDT, USDC). Uses Noah/Fincra even when
 * INTL_PAYROLL_PROVIDER=bachs — that preference is the fiat bank + Bachs-USDT rail.
 */
export function resolveIntlCryptoPaymentProvider(): PaymentProvider {
  const preferred = getIntlPayrollProviderPreference();
  return resolveNoahOrFincra(preferred === 'fincra' ? 'fincra' : 'noah');
}

export function resolveIntlWalletPaymentProvider(): PaymentProvider {
  return resolveNoahOrFincra(getIntlRewardsDepositProviderPreference());
}
