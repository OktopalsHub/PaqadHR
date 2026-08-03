import { isMonnifyLive } from 'src/common/config/monnify.config';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { resolveNgPaymentProvider } from 'src/common/utils/ng-money-provider.util';

export function resolveRewardsWalletVirtualAccountProvider(
  currencyCode: string,
): PaymentProvider | null {
  if (currencyCode.toUpperCase() !== 'NGN') {
    return null;
  }

  return resolveNgPaymentProvider();
}

export function isRewardsWalletVirtualAccountLive(
  provider: PaymentProvider | null,
): boolean | null {
  if (provider === PaymentProvider.NOMBA) {
    return process.env.NOMBA_LIVE === 'true';
  }
  if (provider === PaymentProvider.MONNIFY) {
    return isMonnifyLive();
  }
  return null;
}

export function isRewardsWalletCheckoutLive(provider: PaymentProvider | null): boolean | null {
  return isRewardsWalletVirtualAccountLive(provider);
}

export function rewardsWalletVirtualAccountProviderLabel(
  provider: PaymentProvider | null,
): string | null {
  if (provider === PaymentProvider.NOMBA || provider === PaymentProvider.MONNIFY) {
    return 'Bank transfer account';
  }
  return null;
}
