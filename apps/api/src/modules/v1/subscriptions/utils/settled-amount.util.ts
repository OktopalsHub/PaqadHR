import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import {
  calculatePerSeatTotal,
  isAmountWithinTolerance,
  normalizeWebhookAmount,
} from './per-seat-pricing.util';

/**
 * How a settled subscription payment was validated.
 *
 * - `plan_currency`: paid in the plan's own currency. Compared against our price row.
 * - `paid_currency`: paid in another currency we price ourselves (the NGN sibling on a
 *   USD plan, for example). Compared against that row's exact figure — the same number
 *   `BachsProductSyncService` pushes into Bachs `price.currency_options`.
 * - `provider_reported`: adaptive conversion into a currency we do not price (GHS, KES,
 *   TZS, ...). No local price row exists, so the rate is Bachs' live one and the figure
 *   can only be sanity-banded, not compared.
 */
export type SettledAmountBasis = 'plan_currency' | 'paid_currency' | 'provider_reported';

export type SettledAmountVerdict = {
  /** Amount to persist, in major units of `currency`. */
  amount: number;
  currency: string;
  basis: SettledAmountBasis;
  /** Expected total in `currency`, or null when the provider figure cannot be checked. */
  expectedAmount: number | null;
  withinTolerance: boolean;
};

/**
 * Adaptive conversion only moves the amount for currencies we have no price row for.
 * Those rates sit far from 1 in both directions (NGN is ~1.5e3 per USD), so a wide band
 * catches unit errors and zero-value webhooks without needing an FX rate in the hot path.
 */
const PROVIDER_FX_MIN_RATIO = 0.01;
const PROVIDER_FX_MAX_RATIO = 100;

function normalizeCurrency(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

export function resolveSettledAmount(input: {
  paidAmount: number;
  paidCurrency: string | null | undefined;
  planPrice: PlanPrice;
  /** This plan's price row in `paidCurrency`, when one exists. */
  planPriceInPaidCurrency: PlanPrice | null;
  seatCount: number;
}): SettledAmountVerdict {
  const planCurrency = normalizeCurrency(input.planPrice.currency);
  const paidCurrency = normalizeCurrency(input.paidCurrency) || planCurrency;
  const pricedRow = paidCurrency === planCurrency ? input.planPrice : input.planPriceInPaidCurrency;
  const rawPaid = Number(input.paidAmount);
  const planTotal = calculatePerSeatTotal(input.planPrice, input.seatCount);

  if (!pricedRow) {
    return {
      amount: rawPaid,
      currency: paidCurrency,
      basis: 'provider_reported',
      expectedAmount: null,
      withinTolerance:
        Number.isFinite(rawPaid) &&
        rawPaid > 0 &&
        rawPaid >= planTotal * PROVIDER_FX_MIN_RATIO &&
        rawPaid <= planTotal * PROVIDER_FX_MAX_RATIO,
    };
  }

  const expectedAmount = calculatePerSeatTotal(pricedRow, input.seatCount);
  const normalizedPaid = normalizeWebhookAmount(rawPaid, expectedAmount, paidCurrency);

  return {
    amount: normalizedPaid,
    currency: paidCurrency,
    basis: paidCurrency === planCurrency ? 'plan_currency' : 'paid_currency',
    expectedAmount,
    withinTolerance:
      Number.isFinite(normalizedPaid) && isAmountWithinTolerance(normalizedPaid, expectedAmount),
  };
}
