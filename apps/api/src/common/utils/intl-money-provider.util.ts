import { isFincraConfigured } from '../config/fincra.config';
import { isNoahConfigured } from '../config/noah.config';
import { PaymentProvider } from '../enums/payment-provider.enum';

export type IntlMoneyProvider = 'noah' | 'fincra';

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
  return normalized === 'fincra' ? 'fincra' : 'noah';
}

/** Non-NGN rewards wallet deposit checkout. Canonical: INTL_REWARDS_DEPOSIT_PROVIDER. */
export function getIntlRewardsDepositProviderPreference(): IntlMoneyProvider {
  const normalized = readEnvFirst('INTL_REWARDS_DEPOSIT_PROVIDER');
  return normalized === 'fincra' ? 'fincra' : 'noah';
}

function resolveNoahOrFincra(preferred: IntlMoneyProvider): PaymentProvider {
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
  return resolveNoahOrFincra(getIntlPayrollProviderPreference());
}

export function resolveIntlWalletPaymentProvider(): PaymentProvider {
  return resolveNoahOrFincra(getIntlRewardsDepositProviderPreference());
}
