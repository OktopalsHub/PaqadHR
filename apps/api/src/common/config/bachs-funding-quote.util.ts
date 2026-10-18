import {
  isBachsCryptoAsset,
  isBachsIntlBankCurrency,
  mapBachsCryptoDestinationCurrency,
} from './bachs-payout.util';

export type BachsFundingCurrency = 'USD' | 'NGN';

export type BachsFundingQuote = {
  quote_id: string;
  from_amount?: string;
  to_amount?: string;
};

export type BachsFundingQuoteFn = (input: {
  fromCurrency: string;
  toCurrency: string;
  amount: string;
  payoutMethod?: 'BANK_TRANSFER';
}) => Promise<BachsFundingQuote>;

export type BachsFundingItem = {
  /** Amount we must cover for this employee (salary net or payment amount). */
  amount: number;
  /** Currency of `amount`. */
  amountCurrency: string;
  /** Payout destination currency (NGN/USD/EUR/GBP/USDT). */
  paymentCurrency: string;
  /** Crypto network when paymentCurrency is USDT. */
  cryptoNetwork?: string | null;
  fxAtPayout?: boolean;
};

/**
 * Bachs holds USD + NGN. Any international / stablecoin destination must be funded in USD.
 * All-NGN runs fund in NGN unless the env forces USD-sourced NGN payouts.
 *
 * This is what makes an NGN salary payable in USDT: the run is funded from the USD balance,
 * so the NGN net is converted to its USD equivalent before sizing the checkout. Funding such
 * a run from the NGN balance would treat the NGN figure as USD (see
 * sourceAmountForBachsFundingItem) and mis-size the checkout.
 */
export function pickBachsFundingCurrency(
  items: Array<Pick<BachsFundingItem, 'paymentCurrency'>>,
  payoutSourceCurrency?: string | null,
): BachsFundingCurrency {
  if ((payoutSourceCurrency ?? '').trim().toUpperCase() === 'USD') return 'USD';
  const needsUsd = items.some((item) => {
    const code = item.paymentCurrency.toUpperCase();
    return code !== 'NGN';
  });
  return needsUsd ? 'USD' : 'NGN';
}

/**
 * Bachs destination currency code for quotes (USDT_TRC20, GBP, …).
 *
 * Must agree exactly with what `BachsProvider` will actually pay out, because the value here
 * sizes the checkout we charge the tenant while the provider value decides where the money
 * lands. So it resolves the same asset+network rules and returns null on anything unfundable
 * rather than defaulting: a guessed USDT_TRC20 would let preflight quote a checkout for a rail
 * the payout would then refuse.
 */
export function resolveBachsQuoteDestinationCurrency(
  paymentCurrency: string,
  cryptoNetwork?: string | null,
): string | null {
  const code = paymentCurrency.toUpperCase();
  if (code === 'NGN' || isBachsIntlBankCurrency(code)) return code;
  if (isBachsCryptoAsset(code)) return mapBachsCryptoDestinationCurrency(cryptoNetwork, code);
  return null;
}

/**
 * Quote a source (balance) amount that delivers approximately `targetToAmount` in `toCurrency`.
 * Bachs quotes take `amount` in from_currency only.
 */
export async function quoteSourceAmountForDestination(params: {
  createQuote: BachsFundingQuoteFn;
  fromCurrency: string;
  toCurrency: string;
  targetToAmount: number;
  payoutMethod?: 'BANK_TRANSFER';
}): Promise<{ sourceAmount: number; quoteId: string }> {
  const { createQuote, fromCurrency, toCurrency, targetToAmount, payoutMethod } = params;
  const probe = await createQuote({
    fromCurrency,
    toCurrency,
    amount: '100.00',
    payoutMethod,
  });
  const probeFrom = Number(probe.from_amount);
  const probeTo = Number(probe.to_amount);
  if (!(probeFrom > 0) || !(probeTo > 0)) {
    throw new Error('Bachs payout quote missing amounts');
  }

  let fromAmount = (targetToAmount * probeFrom) / probeTo;
  let quote = await createQuote({
    fromCurrency,
    toCurrency,
    amount: fromAmount.toFixed(2),
    payoutMethod,
  });
  let got = Number(quote.to_amount);
  let quotedFrom = Number(quote.from_amount);

  // A tolerance is useful for FX drift, but must never allow an employee to receive less
  // than the requested amount. Requote even when an underpayment is within that tolerance.
  if (
    Number.isFinite(got) &&
    got > 0 &&
    Number.isFinite(quotedFrom) &&
    quotedFrom > 0 &&
    (got < targetToAmount || Math.abs(got - targetToAmount) / targetToAmount > 0.005)
  ) {
    fromAmount = (targetToAmount * quotedFrom) / got;
    quote = await createQuote({
      fromCurrency,
      toCurrency,
      amount: fromAmount.toFixed(2),
      payoutMethod,
    });
    got = Number(quote.to_amount);
    quotedFrom = Number(quote.from_amount);
  }

  if (
    !Number.isFinite(got) ||
    got < targetToAmount ||
    !Number.isFinite(quotedFrom) ||
    quotedFrom <= 0 ||
    !quote.quote_id
  ) {
    throw new Error('Bachs payout quote does not cover the requested recipient amount');
  }
  return { sourceAmount: Math.round(quotedFrom * 100) / 100, quoteId: quote.quote_id };
}

/**
 * How much of `fundingCurrency` must sit on the Bachs balance to pay one item.
 * Use Bachs quotes for cross-currency bank and stablecoin payouts so the checkout amount
 * includes the provider's current FX rate and payout costs.
 */
export async function sourceAmountForBachsFundingItem(params: {
  item: BachsFundingItem;
  fundingCurrency: BachsFundingCurrency;
  createQuote: BachsFundingQuoteFn;
}): Promise<number> {
  const { item, fundingCurrency, createQuote } = params;
  const amount = Number(item.amount);
  if (!(amount > 0)) return 0;

  const amountCurrency = item.amountCurrency.toUpperCase();
  const paymentCurrency = item.paymentCurrency.toUpperCase();
  const destination = resolveBachsQuoteDestinationCurrency(paymentCurrency, item.cryptoNetwork);
  if (!destination) {
    throw new Error(`Bachs cannot fund payouts in ${paymentCurrency}`);
  }

  const destinationBase = destination.split('_')[0];
  // Stablecoin rails are crypto, not bank rails — same rule the provider applies.
  const isCryptoDestination = destinationBase === 'USDT' || destinationBase === 'USDC';
  const bankMethod = isCryptoDestination ? undefined : ('BANK_TRANSFER' as const);

  // Amount already in the funding balance currency (incl. FX-at-payout salary in USD).
  if (amountCurrency === fundingCurrency) {
    if (destinationBase === fundingCurrency) {
      // Same-currency bank payouts cannot use a conversion quote. Their per-transfer fee
      // is handled by the configured payout-fee reserve in payroll preflight.
      return Math.round(amount * 100) / 100;
    }
    if (isCryptoDestination) {
      // A USD-denominated salary paid in a stablecoin still needs a destination-targeted
      // quote so the employee receives the intended amount after Bachs' payout costs.
      const quoted = await quoteSourceAmountForDestination({
        createQuote,
        fromCurrency: fundingCurrency,
        toCurrency: destination,
        targetToAmount: amount,
      });
      return quoted.sourceAmount;
    }
    const quote = await createQuote({
      fromCurrency: fundingCurrency,
      toCurrency: destination,
      amount: amount.toFixed(2),
      payoutMethod: bankMethod,
    });
    const sourced = Number(quote.from_amount);
    if (!(sourced > 0)) throw new Error('Bachs payout quote missing source amount');
    return Math.round(sourced * 100) / 100;
  }

  // Amount is what the employee receives in the destination currency.
  if (amountCurrency === paymentCurrency || amountCurrency === destinationBase) {
    if (destinationBase === fundingCurrency) {
      return Math.round(amount * 100) / 100;
    }
    const quoted = await quoteSourceAmountForDestination({
      createQuote,
      fromCurrency: fundingCurrency,
      toCurrency: destination,
      targetToAmount: amount,
      payoutMethod: bankMethod,
    });
    return quoted.sourceAmount;
  }

  throw new Error(
    `Cannot fund ${paymentCurrency} payout denominated in ${amountCurrency} from ${fundingCurrency}`,
  );
}

export async function sumBachsFundingSourceAmount(params: {
  items: BachsFundingItem[];
  fundingCurrency: BachsFundingCurrency;
  createQuote: BachsFundingQuoteFn;
}): Promise<number> {
  let total = 0;
  for (const item of params.items) {
    total += await sourceAmountForBachsFundingItem({
      item,
      fundingCurrency: params.fundingCurrency,
      createQuote: params.createQuote,
    });
  }
  return Math.round(total * 100) / 100;
}

export function applyPayrollFee(
  employeeTotal: number,
  feePercentage: number,
): {
  employeeTotal: number;
  platformFee: number;
  checkoutTotal: number;
  feePercentage: number;
} {
  const platformFee = Math.round(employeeTotal * (feePercentage / 100) * 100) / 100;
  return {
    employeeTotal,
    platformFee,
    checkoutTotal: Math.round((employeeTotal + platformFee) * 100) / 100,
    feePercentage,
  };
}
