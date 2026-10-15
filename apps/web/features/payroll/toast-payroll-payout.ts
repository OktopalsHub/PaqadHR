import { toast } from 'sonner';

type PayoutCounts = {
  successfulPayments?: number;
  failedPayments?: number;
  processingPayments?: number;
};

export function toastPayrollPayoutResult(
  result: PayoutCounts | undefined,
  mode: 'pay' | 'retry' = 'pay',
): void {
  const ok = result?.successfulPayments ?? 0;
  const failed = result?.failedPayments ?? 0;
  const processing = result?.processingPayments ?? 0;

  if (ok > 0 && failed === 0 && processing === 0) {
    toast.success(`Paid ${ok}`);
    return;
  }
  if (processing > 0 && failed === 0) {
    const n = processing + ok;
    toast.message(n === 1 ? 'Sending 1 payment…' : `Sending ${n} payments…`);
    return;
  }
  if (ok > 0 || processing > 0) {
    toast.warning(`Paid ${ok}, ${failed} failed — retry the rest`);
    return;
  }
  if (failed > 0) {
    toast.error(mode === 'retry' ? 'Retry failed' : 'Payment failed');
    return;
  }
  toast.error('No payments sent');
}
