import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { isMonnifyConfigured } from 'src/common/config/monnify.config';
import { isNombaConfigured, isNombaLive } from 'src/common/config/nomba.config';
import { getNoahEnvironment } from 'src/common/config/noah.config';

export function resolveRewardsWalletVirtualAccountProvider(
  currencyCode: string,
): PaymentProvider | null {
  if (currencyCode.toUpperCase() !== 'NGN') {
    return null;
  }

  const preferred = (process.env.REWARDS_NG_PROVIDER || 'nomba').trim().toLowerCase();
  if (preferred === PaymentProvider.MONNIFY && isMonnifyConfigured()) {
    return PaymentProvider.MONNIFY;
  }
  if (preferred === PaymentProvider.NOMBA && isNombaConfigured()) {
    return PaymentProvider.NOMBA;
  }
  if (isNombaConfigured()) {
    return PaymentProvider.NOMBA;
  }
  if (isMonnifyConfigured()) {
    return PaymentProvider.MONNIFY;
  }
  return null;
}

export function rewardsWalletVirtualAccountProviderLabel(
  provider: PaymentProvider | null,
): string | null {
  if (provider === PaymentProvider.NOMBA) {
    return 'Nomba virtual account';
  }
  if (provider === PaymentProvider.MONNIFY) {
    return 'Monnify reserved account';
  }
  return null;
}

export function isRewardsWalletVirtualAccountLive(provider: PaymentProvider | null): boolean | null {
  if (provider === PaymentProvider.NOMBA) {
    return isNombaLive();
  }
  if (provider === PaymentProvider.MONNIFY) {
    return process.env.MONNIFY_LIVE === 'true';
  }
  return null;
}

export function rewardsWalletCheckoutLive(provider: PaymentProvider): boolean {
  return provider === PaymentProvider.NOMBA
    ? isNombaLive()
    : getNoahEnvironment() === 'production';
}
