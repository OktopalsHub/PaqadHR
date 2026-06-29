import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import { BILLING_AMOUNT_TOLERANCE } from '../constants/billing.constants';

export function resolveSeatCount(seatCount: number): number {
  return Math.max(1, seatCount);
}

export function calculatePerSeatTotal(planPrice: PlanPrice, seatCount: number): number {
  const seats = resolveSeatCount(seatCount);
  const pricing = planPrice.calculateMonthlyPrice(seats);
  if (pricing.totalPrice > 0) {
    return pricing.totalPrice;
  }

  const unitPrice = Number(planPrice.monthlyPrice);
  return unitPrice * seats;
}

export function formatNombaAmount(amount: number): string {
  return amount.toFixed(2);
}

export function toMinorUnits(amount: number, currency: string): number {
  const code = currency.toUpperCase();
  const zeroDecimalCurrencies = new Set(['JPY', 'KRW', 'XOF', 'XAF']);
  const factor = zeroDecimalCurrencies.has(code) ? 1 : 100;
  return Math.round(amount * factor);
}

export function fromMinorUnits(amountMinor: number, currency: string): number {
  const code = currency.toUpperCase();
  const zeroDecimalCurrencies = new Set(['JPY', 'KRW', 'XOF', 'XAF']);
  const factor = zeroDecimalCurrencies.has(code) ? 1 : 100;
  return amountMinor / factor;
}

export function normalizeWebhookAmount(
  paidAmount: number,
  expectedAmount: number,
  currency: string,
): number {
  const paid = Number(paidAmount);
  if (!Number.isFinite(paid)) {
    return NaN;
  }
  if (paid > expectedAmount * 10) {
    return fromMinorUnits(paid, currency);
  }
  return paid;
}

export function isAmountWithinTolerance(paid: number, expected: number): boolean {
  return Math.abs(paid - expected) <= BILLING_AMOUNT_TOLERANCE;
}
