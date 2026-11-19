import type { PayrollRun } from '../entities/payroll-run.entity';

export type FloatTopupMeta = {
  orderReference?: string;
  status?: 'pending' | 'completed';
  completedAt?: string;
  shortfall?: number;
  provider?: string;
  /** Balance currency the company funded (drives Bachs payout source quotes). */
  fundingCurrency?: string;
  /** Set when the checkout is opened, so a retry can tell creation-in-flight from an expired link. */
  checkoutRequestedAt?: string;
  /** Stored so a second click resumes the same session instead of orphaning a paid one. */
  checkoutUrl?: string;
  /** Superseded references, newest last: a payment on any of them still belongs to this run. */
  references?: string[];
};

/** Keeps the reference being replaced in the run's history so a late payment still matches. */
export function withFloatTopupHistory(latest: FloatTopupMeta, nextReference: string): string[] {
  const previous =
    latest.orderReference && latest.orderReference !== nextReference ? [latest.orderReference] : [];
  return [...(latest.references ?? []), ...previous]
    .filter((ref) => ref !== nextReference)
    .slice(-5);
}

export function readFloatTopupMeta(run: PayrollRun): FloatTopupMeta {
  const raw = run.metadata?.floatTopup;
  if (!raw || typeof raw !== 'object') return {};
  return raw as FloatTopupMeta;
}
