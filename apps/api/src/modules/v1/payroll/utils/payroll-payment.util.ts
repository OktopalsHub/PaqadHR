import type { PayrollItem } from '../entities/payroll-item.entity';

/** Prefer paymentAmount; for FX-at-payout rows use salary net until provider quotes. */
export function resolvePayrollPayoutAmount(item: PayrollItem): number {
  const meta = item.metadata ?? {};
  if (meta.fxAtPayout === true) {
    const net = Number(item.netAmount);
    if (Number.isFinite(net) && net > 0) return net;
  }
  const payment = Number(item.paymentAmount);
  if (Number.isFinite(payment) && payment > 0) {
    return payment;
  }
  const net = Number(item.netAmount);
  if (Number.isFinite(net) && net > 0) {
    return net;
  }
  return 0;
}
