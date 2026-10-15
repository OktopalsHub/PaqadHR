/**
 * Lightweight self-check for payroll schedule/pay-now helpers.
 * Run: npx tsx apps/api/src/modules/v1/payroll/utils/payroll-payout-mode.check.ts
 */
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isDueScheduled(input: {
  status: string;
  payoutMode: string | null;
  paymentDate: string;
  today: string;
}): boolean {
  return (
    input.status === 'approved' &&
    input.payoutMode === 'scheduled' &&
    input.paymentDate <= input.today
  );
}

function salaryMatchesRun(salaryCurrency: string, runCurrency: string): boolean {
  return salaryCurrency.toUpperCase() === runCurrency.toUpperCase();
}

assert(
  isDueScheduled({
    status: 'approved',
    payoutMode: 'scheduled',
    paymentDate: '2026-07-22',
    today: '2026-07-22',
  }),
  'due scheduled run should process',
);
assert(
  !isDueScheduled({
    status: 'approved',
    payoutMode: 'scheduled',
    paymentDate: '2026-08-01',
    today: '2026-07-22',
  }),
  'future scheduled run should wait',
);
assert(
  !isDueScheduled({
    status: 'approved',
    payoutMode: 'immediate',
    paymentDate: '2026-07-01',
    today: '2026-07-22',
  }),
  'immediate mode is not cron-driven',
);
assert(salaryMatchesRun('ngn', 'NGN'), 'currency compare is case-insensitive');
assert(!salaryMatchesRun('USD', 'NGN'), 'mismatched currencies skip');

export {};
