import { isBachsWalletTopupConfigured } from '../config/bachs.config';
import { isMonnifyConfigured } from '../config/monnify.config';
import { isNombaConfigured } from '../config/nomba.config';
import { PaymentProvider } from '../enums/payment-provider.enum';

export type NgMoneyProvider = 'nomba' | 'monnify';

function readEnvFirst(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim().toLowerCase();
    if (value) return value;
  }
  return undefined;
}

/**
 * Nomba ↔ Monnify peer switch for NGN payroll / bank payouts.
 * Canonical: NG_PAYROLL_PROVIDER. Legacy fallback: NG_PAYMENTS_PROVIDER.
 */
export function getNgPayrollProviderPreference(): NgMoneyProvider {
  const normalized = readEnvFirst('NG_PAYROLL_PROVIDER', 'NG_PAYMENTS_PROVIDER');
  return normalized === 'monnify' ? 'monnify' : 'nomba';
}

/** @deprecated Prefer getNgPayrollProviderPreference */
export const getNgPaymentsProviderPreference = getNgPayrollProviderPreference;

function resolveNombaOrMonnify(preferred: NgMoneyProvider): PaymentProvider {
  if (preferred === 'monnify') {
    if (isMonnifyConfigured()) {
      return PaymentProvider.MONNIFY;
    }
    if (isNombaConfigured()) {
      return PaymentProvider.NOMBA;
    }
    return PaymentProvider.MONNIFY;
  }

  if (isNombaConfigured()) {
    return PaymentProvider.NOMBA;
  }
  if (isMonnifyConfigured()) {
    return PaymentProvider.MONNIFY;
  }
  return PaymentProvider.NOMBA;
}

/** NGN payroll / bank payouts — Nomba or Monnify. */
export function resolveNgPaymentProvider(): PaymentProvider {
  return resolveNombaOrMonnify(getNgPayrollProviderPreference());
}

/**
 * Rewards wallet deposit checkout for NG / NGN.
 * Canonical: NG_REWARDS_DEPOSIT_PROVIDER. Legacy: NG_WALLET_PAYMENTS_PROVIDER.
 * Empty → same Nomba↔Monnify peer as payroll. Override with `bachs` for Bachs checkout deposits.
 */
export function getNgRewardsDepositProviderPreference(): NgMoneyProvider | 'bachs' {
  const depositPref = readEnvFirst('NG_REWARDS_DEPOSIT_PROVIDER', 'NG_WALLET_PAYMENTS_PROVIDER');
  if (depositPref === 'bachs') {
    return 'bachs';
  }
  if (depositPref === 'monnify' || depositPref === 'nomba') {
    return depositPref;
  }
  return getNgPayrollProviderPreference();
}

/** @deprecated Prefer getNgRewardsDepositProviderPreference */
export const getNgWalletPaymentsProviderPreference = getNgRewardsDepositProviderPreference;

export function resolveNgWalletPaymentProvider(): PaymentProvider {
  const preferred = getNgRewardsDepositProviderPreference();

  if (preferred === 'bachs') {
    if (isBachsWalletTopupConfigured('NGN')) {
      return PaymentProvider.BACHS;
    }
    return resolveNombaOrMonnify(getNgPayrollProviderPreference());
  }

  return resolveNombaOrMonnify(preferred);
}

/**
 * Rewards airtime / data / utility for NG.
 * Canonical: NG_REWARDS_AIRTIME_PROVIDER (default nomba). Values: nomba|monnify.
 */
export function getNgRewardsAirtimeProviderPreference(): NgMoneyProvider {
  const normalized = process.env.NG_REWARDS_AIRTIME_PROVIDER?.trim().toLowerCase();
  return normalized === 'monnify' ? 'monnify' : 'nomba';
}

export function resolveNgRewardsAirtimeProvider(): PaymentProvider {
  return resolveNombaOrMonnify(getNgRewardsAirtimeProviderPreference());
}
