import { BadRequestException } from '@nestjs/common';
import {
  isCryptoCurrency,
  isNoahNativeCryptoCurrency,
} from 'src/common/constants/crypto-currencies.constant';
import { isSupportedFiatCurrency } from 'src/common/constants/supported-fiat-currencies.constant';
import type { FiatExchangeService } from 'src/common/services/fiat-exchange.service';

export type PayrollPayoutConversion = {
  paymentAmount: number;
  exchangeRate: number;
  fxAtPayout: boolean;
};

export async function resolvePayrollPayoutConversion(
  netAmount: number,
  salaryCurrency: string,
  payoutCurrency: string,
  fiatExchange: Pick<FiatExchangeService, 'convert'>,
): Promise<PayrollPayoutConversion> {
  const salary = salaryCurrency.trim().toUpperCase();
  const payout = payoutCurrency.trim().toUpperCase();
  if (salary === payout) {
    return { paymentAmount: netAmount, exchangeRate: 1, fxAtPayout: false };
  }
  const salaryIsCrypto = isCryptoCurrency(salary);
  const payoutIsCrypto = isCryptoCurrency(payout);
  if (
    (salaryIsCrypto && !payoutIsCrypto && !isSupportedFiatCurrency(payout)) ||
    (payoutIsCrypto && !salaryIsCrypto && !isSupportedFiatCurrency(salary)) ||
    (!salaryIsCrypto &&
      !payoutIsCrypto &&
      (!isSupportedFiatCurrency(salary) || !isSupportedFiatCurrency(payout)))
  ) {
    const unsupported = [salary, payout].filter(
      (code) => !isSupportedFiatCurrency(code) && !isCryptoCurrency(code),
    );
    throw new BadRequestException(
      isNoahNativeCryptoCurrency(unsupported[0] ?? '')
        ? `${unsupported[0]} payouts are not supported. Pay employees in USDT or USDC instead.`
        : `Cannot pay ${salary} salary in ${payout}. Supported payout currencies: NGN, USD, EUR, GBP, USDT, USDC.`,
    );
  }
  if (salaryIsCrypto && payoutIsCrypto) {
    throw new BadRequestException(
      `Bridge payroll cannot convert ${salary} to ${payout}; select the same stablecoin for salary and payout.`,
    );
  }
  if ((salary === 'NGN' || payout === 'NGN') && salary !== payout) {
    throw new BadRequestException(
      'Bridge FX for NGN is not available for this payroll route. Select a confirmed currency route.',
    );
  }
  // USDC is USD-pegged. A USD salary paid in USDC (or USDC salary paid in USD) is
  // a denomination change only; the subsequent payment route still must support it.
  if ((salary === 'USD' && payout === 'USDC') || (salary === 'USDC' && payout === 'USD')) {
    return { paymentAmount: netAmount, exchangeRate: 1, fxAtPayout: false };
  }

  const paymentAmount = await fiatExchange.convert(netAmount, salary, payout);
  const exchangeRate = netAmount > 0 ? paymentAmount / netAmount : 0;
  return { paymentAmount, exchangeRate, fxAtPayout: false };
}
