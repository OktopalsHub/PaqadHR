import { isMonnifyLive } from 'src/common/config/monnify.config';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { resolveNgPaymentProvider } from 'src/common/utils/ng-money-provider.util';

/** Rewards wallet checkout rail — NG tenant country or NGN wallet → Nomba/Monnify; else Noah. */
export function resolveRewardsWalletPaymentProvider(
  tenantCountryCode?: string | null,
  walletCurrencyCode?: string | null,
): PaymentProvider {
  const country = GeoLocationHelper.toStoredCountryCode(tenantCountryCode ?? '') ?? '';
  const currency = walletCurrencyCode?.trim().toUpperCase() ?? '';
  if (country === 'NG' || currency === 'NGN') {
    return resolveNgPaymentProvider();
  }
  return PaymentProvider.NOAH;
}

export function isRewardsWalletCheckoutLive(provider: PaymentProvider | null): boolean | null {
  if (provider === PaymentProvider.NOMBA) {
    return process.env.NOMBA_LIVE === 'true';
  }
  if (provider === PaymentProvider.MONNIFY) {
    return isMonnifyLive();
  }
  return null;
}
