/**
 * True while the hosted float top-up checkout for a payroll run is still
 * outstanding — the run stays `approved` and no items move until the webhook lands,
 * so this is the only signal that a payout is already underway.
 */
export function isPayrollFundingPending(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const floatTopup = (metadata as Record<string, unknown>).floatTopup;
  if (!floatTopup || typeof floatTopup !== 'object') return false;
  return (floatTopup as Record<string, unknown>).status === 'pending';
}
