import { isBachsWalletTopupConfigured } from '../config/bachs.config';
import { isFincraConfigured } from '../config/fincra.config';
import { isMonnifyConfigured } from '../config/monnify.config';
import { isNombaConfigured } from '../config/nomba.config';
import { PaymentProvider } from '../enums/payment-provider.enum';

export type NgMoneyProvider = 'nomba' | 'monnify' | 'fincra';

function readEnvFirst(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim().toLowerCase();
    if (value) return value;
  }
  return undefined;
}

/**
 * Nomba ↔ Monnify ↔ Fincra peer switch for NGN payroll / bank payouts.
 * Canonical: NG_PAYROLL_PROVIDER. Legacy fallback: NG_PAYMENTS_PROVIDER.
 */
export function getNgPayrollProviderPreference(): NgMoneyProvider {
  const normalized = readEnvFirst('NG_PAYROLL_PROVIDER', 'NG_PAYMENTS_PROVIDER');
  if (normalized === 'monnify') return 'monnify';
  if (normalized === 'fincra') return 'fincra';
  return 'nomba';
}

/** @deprecated Prefer getNgPayrollProviderPreference */
export const getNgPaymentsProviderPreference = getNgPayrollProviderPreference;

function resolveNgMoneyProvider(preferred: NgMoneyProvider): PaymentProvider {
  if (preferred === 'fincra') {
    if (isFincraConfigured()) return PaymentProvider.FINCRA;
    if (isNombaConfigured()) return PaymentProvider.NOMBA;
    if (isMonnifyConfigured()) return PaymentProvider.MONNIFY;
    return PaymentProvider.FINCRA;
  }

  if (preferred === 'monnify') {
    if (isMonnifyConfigured()) return PaymentProvider.MONNIFY;
    if (isNombaConfigured()) return PaymentProvider.NOMBA;
    if (isFincraConfigured()) return PaymentProvider.FINCRA;
    return PaymentProvider.MONNIFY;
  }

  if (isNombaConfigured()) return PaymentProvider.NOMBA;
  if (isMonnifyConfigured()) return PaymentProvider.MONNIFY;
  if (isFincraConfigured()) return PaymentProvider.FINCRA;
  return PaymentProvider.NOMBA;
}

/** NGN payroll / bank payouts — Nomba, Monnify, or Fincra. */
export function resolveNgPaymentProvider(): PaymentProvider {
  return resolveNgMoneyProvider(getNgPayrollProviderPreference());
}

/**
 * Rewards wallet deposit checkout for NG / NGN.
 * Canonical: NG_REWARDS_DEPOSIT_PROVIDER. Legacy: NG_WALLET_PAYMENTS_PROVIDER.
 * Empty → same peer as payroll. Override with `bachs` for Bachs checkout deposits.
 */
export function getNgRewardsDepositProviderPreference(): NgMoneyProvider | 'bachs' {
  const depositPref = readEnvFirst('NG_REWARDS_DEPOSIT_PROVIDER', 'NG_WALLET_PAYMENTS_PROVIDER');
  if (depositPref === 'bachs') {
    return 'bachs';
  }
  if (depositPref === 'monnify' || depositPref === 'nomba' || depositPref === 'fincra') {
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
    return resolveNgMoneyProvider(getNgPayrollProviderPreference());
  }

  return resolveNgMoneyProvider(preferred);
}

/**
 * Rewards airtime / data / utility for NG.
 * Canonical: NG_REWARDS_AIRTIME_PROVIDER (default nomba). Values: nomba|monnify.
 */
export function getNgRewardsAirtimeProviderPreference(): 'nomba' | 'monnify' {
  const normalized = process.env.NG_REWARDS_AIRTIME_PROVIDER?.trim().toLowerCase();
  if (normalized === 'monnify') return 'monnify';
  return 'nomba';
}

export function resolveNgRewardsAirtimeProvider(): PaymentProvider {
  const preferred = getNgRewardsAirtimeProviderPreference();
  if (preferred === 'monnify') {
    if (isMonnifyConfigured()) return PaymentProvider.MONNIFY;
    if (isNombaConfigured()) return PaymentProvider.NOMBA;
    return PaymentProvider.MONNIFY;
  }
  if (isNombaConfigured()) return PaymentProvider.NOMBA;
  if (isMonnifyConfigured()) return PaymentProvider.MONNIFY;
  return PaymentProvider.NOMBA;
}
