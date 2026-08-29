import {
  isBachsWalletTopupConfigured,
  resolveBachsEnvironment,
} from 'src/common/config/bachs.config';
import { isFincraLive } from 'src/common/config/fincra.config';
import { isMonnifyLive } from 'src/common/config/monnify.config';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { resolveIntlWalletPaymentProvider } from 'src/common/utils/intl-money-provider.util';
import { resolveNgWalletPaymentProvider } from 'src/common/utils/ng-money-provider.util';

/** Rewards wallet checkout — NG/NGN → wallet provider; USD → Bachs when configured; else intl provider. */
export function resolveRewardsWalletPaymentProvider(
  tenantCountryCode?: string | null,
  walletCurrencyCode?: string | null,
): PaymentProvider {
  const country = GeoLocationHelper.toStoredCountryCode(tenantCountryCode ?? '') ?? '';
  const currency = walletCurrencyCode?.trim().toUpperCase() ?? '';
  if (country === 'NG' || currency === 'NGN') {
    return resolveNgWalletPaymentProvider();
  }
  if (currency === 'USD' && isBachsWalletTopupConfigured('USD')) {
    return PaymentProvider.BACHS;
  }
  return resolveIntlWalletPaymentProvider();
}

export function isRewardsWalletCheckoutLive(provider: PaymentProvider | null): boolean | null {
  if (provider === PaymentProvider.NOMBA) {
    return process.env.NOMBA_LIVE === 'true';
  }
  if (provider === PaymentProvider.MONNIFY) {
    return isMonnifyLive();
  }
  if (provider === PaymentProvider.FINCRA) {
    return isFincraLive();
  }
  if (provider === PaymentProvider.BACHS) {
    return resolveBachsEnvironment() === 'live';
  }
  return null;
}
