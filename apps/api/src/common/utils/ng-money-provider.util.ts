import { isBachsWalletTopupConfigured } from '../config/bachs.config';
import { isMonnifyConfigured } from '../config/monnify.config';
import { isNombaConfigured } from '../config/nomba.config';
import { PaymentProvider } from '../enums/payment-provider.enum';

export type NgMoneyProvider = 'nomba' | 'monnify';

/**
 * Nomba ↔ Monnify peer switch for NGN money rails (payroll, wallet deposits, etc.).
 * Bachs is not a peer here — use NG_WALLET_PAYMENTS_PROVIDER=bachs for deposit-only override.
 */
export function getNgPaymentsProviderPreference(): NgMoneyProvider {
  const normalized = process.env.NG_PAYMENTS_PROVIDER?.trim().toLowerCase();
  return normalized === 'monnify' ? 'monnify' : 'nomba';
}

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
  return resolveNombaOrMonnify(getNgPaymentsProviderPreference());
}

/**
 * Rewards wallet deposit checkout for NG / NGN.
 * Defaults to the same Nomba↔Monnify peer as payroll (`NG_PAYMENTS_PROVIDER`).
 * Only override with `NG_WALLET_PAYMENTS_PROVIDER=bachs` for Bachs checkout deposits.
 */
export function getNgWalletPaymentsProviderPreference(): NgMoneyProvider | 'bachs' {
  const walletPref = process.env.NG_WALLET_PAYMENTS_PROVIDER?.trim().toLowerCase();
  if (walletPref === 'bachs') {
    return 'bachs';
  }
  // Explicit nomba/monnify on the wallet var still works, but peers should prefer NG_PAYMENTS_PROVIDER.
  if (walletPref === 'monnify' || walletPref === 'nomba') {
    return walletPref;
  }
  return getNgPaymentsProviderPreference();
}

export function resolveNgWalletPaymentProvider(): PaymentProvider {
  const preferred = getNgWalletPaymentsProviderPreference();

  if (preferred === 'bachs') {
    if (isBachsWalletTopupConfigured('NGN')) {
      return PaymentProvider.BACHS;
    }
    return resolveNombaOrMonnify(getNgPaymentsProviderPreference());
  }

  return resolveNombaOrMonnify(preferred);
}
