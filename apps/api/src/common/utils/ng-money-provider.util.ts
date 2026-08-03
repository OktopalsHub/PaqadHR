import { isMonnifyConfigured } from '../config/monnify.config';
import { isNombaConfigured } from '../config/nomba.config';
import { PaymentProvider } from '../enums/payment-provider.enum';

export type NgPaymentsProvider = 'nomba' | 'monnify';

/** NGN payouts, rewards VA, and wallet checkout — Nomba or Monnify only (not Bachs). */
export function getNgPaymentsProviderPreference(): NgPaymentsProvider {
  const normalized = process.env.NG_PAYMENTS_PROVIDER?.trim().toLowerCase();
  return normalized === 'monnify' ? 'monnify' : 'nomba';
}

export function resolveNgPaymentProvider(): PaymentProvider {
  const preferred = getNgPaymentsProviderPreference();

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
