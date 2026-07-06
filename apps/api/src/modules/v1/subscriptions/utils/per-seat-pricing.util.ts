import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import {
  BILLING_AMOUNT_TOLERANCE,
  MIN_SEAT_PRORATION_CHARGE,
} from '../constants/billing.constants';

export function resolveSeatCount(seatCount: number): number {
  return Math.max(1, seatCount);
}

export function getPerSeatMonthlyPrice(planPrice: PlanPrice): number {
  const fromRegional = planPrice.config?.pricePerUser;
  if (fromRegional != null && Number(fromRegional) > 0) {
    return Number(fromRegional);
  }
  return Number(planPrice.monthlyPrice);
}

export function calculateProratedSeatCharge(
  planPrice: PlanPrice,
  extraSeats: number,
  periodStart: Date,
  periodEnd: Date,
  asOf: Date = new Date(),
): { amount: number; daysRemaining: number; daysInPeriod: number } {
  if (extraSeats <= 0) {
    return { amount: 0, daysRemaining: 0, daysInPeriod: 0 };
  }

  const startMs = periodStart.getTime();
  const endMs = periodEnd.getTime();
  const daysInPeriod = Math.max(1, (endMs - startMs) / (24 * 60 * 60 * 1000));
  const daysRemaining = Math.max(0, (endMs - asOf.getTime()) / (24 * 60 * 60 * 1000));
  const fraction = Math.min(1, daysRemaining / daysInPeriod);

  const perSeat = getPerSeatMonthlyPrice(planPrice);
  let amount = Math.round(extraSeats * perSeat * fraction * 100) / 100;

  if (amount > 0 && amount < MIN_SEAT_PRORATION_CHARGE) {
    amount = MIN_SEAT_PRORATION_CHARGE;
  }

  return { amount, daysRemaining, daysInPeriod };
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
