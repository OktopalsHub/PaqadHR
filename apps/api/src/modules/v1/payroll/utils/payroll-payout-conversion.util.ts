import { isCryptoCurrency } from 'src/common/constants/crypto-currencies.constant';
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
  const paymentAmount = await fiatExchange.convert(netAmount, salary, payout);
  const exchangeRate = netAmount > 0 ? paymentAmount / netAmount : 0;
  return { paymentAmount, exchangeRate, fxAtPayout: false };
}
