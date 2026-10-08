import type { PayrollRun } from '@/lib/schemas/payroll';

export type PayrollRowAction =
  | { kind: 'calculate' }
  | { kind: 'approve' }
  | { kind: 'fund-and-pay'; label: string }
  | { kind: 'retry' }
  | { kind: 'disburse' }
  | { kind: 'none'; note: 'Payment in progress' | 'Paid' | null };

/**
 * Primary action for a payroll run row.
 *
 * A run's `status` alone cannot decide this. Async payout rails (Bachs) leave every item
 * `processing` until a webhook confirms it, and the run stays `approved` the whole time —
 * so a status-only check kept offering "Pay employees" on a run with nothing left to pay,
 * which then failed with "No employees could be paid".
 *
 * `itemCounts` is absent until the list endpoint includes counts; treat that as "unknown"
 * and keep the previous status-only behaviour rather than guessing.
 */
export function payrollRowAction(
  run: Pick<PayrollRun, 'status' | 'payoutMode' | 'itemCounts'>,
  options: { isAdmin: boolean; payrollGatewayEnabled: boolean },
): PayrollRowAction {
  const { isAdmin, payrollGatewayEnabled } = options;
  if (!isAdmin) return { kind: 'none', note: null };

  const counts = run.itemCounts;
  const pending = counts?.pending ?? 0;
  const inFlight = counts?.processing ?? 0;
  const paid = counts?.paid ?? 0;
  const failed = counts?.failed ?? 0;
  // Unknown counts (e.g. a manager's list) must not read as "nothing pending".
  const nothingLeftToPay = counts != null && pending === 0;

  if (run.status === 'draft') return { kind: 'calculate' };
  if (run.status === 'processing') return { kind: 'approve' };

  if (run.status === 'approved') {
    if (nothingLeftToPay) {
      if (failed > 0) {
        return payrollGatewayEnabled ? { kind: 'retry' } : { kind: 'disburse' };
      }
      if (inFlight > 0) return { kind: 'none', note: 'Payment in progress' };
      // Only claim "Paid" when someone actually received a payment. An all-cancelled run
      // (or empty counts) has nothing pending and nothing in flight but paid nobody.
      if (paid > 0) return { kind: 'none', note: 'Paid' };
      return { kind: 'none', note: null };
    }
    // Items are still pending, so there is something to pay.
    return payrollGatewayEnabled
      ? {
          kind: 'fund-and-pay',
          label: run.payoutMode === 'scheduled' ? 'Pay now instead' : 'Pay employees',
        }
      : { kind: 'disburse' };
  }

  if (run.status === 'failed' && payrollGatewayEnabled) return { kind: 'retry' };
  return { kind: 'none', note: null };
}
