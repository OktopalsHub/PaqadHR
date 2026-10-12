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
  if (isCryptoCurrency(salary) || isCryptoCurrency(payout)) {
    return { paymentAmount: 0, exchangeRate: 0, fxAtPayout: true };
  }

  // Neither side is a supported currency. Without this guard the pair falls through to the
  // fiat converter, which has no rate for e.g. NGN→SOL and returns a bogus amount that is
  // then paid out. Reject instead of quoting a conversion that cannot exist.
  if (!isSupportedFiatCurrency(salary) || !isSupportedFiatCurrency(payout)) {
    const unsupported = [salary, payout].filter(
      (code) => !isSupportedFiatCurrency(code) && !isCryptoCurrency(code),
    );
    throw new BadRequestException(
      isNoahNativeCryptoCurrency(unsupported[0] ?? '')
        ? `${unsupported[0]} payouts are not supported. Pay employees in USDT or USDC instead.`
        : `Cannot pay ${salary} salary in ${payout}. Supported payout currencies: NGN, USD, EUR, GBP, USDT, USDC.`,
    );
  }

  const paymentAmount = await fiatExchange.convert(netAmount, salary, payout);
  const exchangeRate = netAmount > 0 ? paymentAmount / netAmount : 0;
  return { paymentAmount, exchangeRate, fxAtPayout: false };
}
