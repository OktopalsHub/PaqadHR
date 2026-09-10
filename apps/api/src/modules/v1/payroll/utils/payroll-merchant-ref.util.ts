/** Payroll payout customer reference: payroll_{runId}_{itemId} or with retry suffix _r{n}. */
export const PAYROLL_MERCHANT_REF_PATTERN =
  /^payroll_([0-9a-f-]{36})_([0-9a-f-]{36})(?:_r(\d+))?$/i;

export function buildPayrollMerchantRef(
  payrollRunId: string,
  payrollItemId: string,
  retryAttempt = 0,
): string {
  const base = `payroll_${payrollRunId}_${payrollItemId}`;
  return retryAttempt > 0 ? `${base}_r${retryAttempt}` : base;
}

export function parsePayrollMerchantRef(
  merchantRef: string,
): { payrollRunId: string; payrollItemId: string; retryAttempt: number } | null {
  const match = PAYROLL_MERCHANT_REF_PATTERN.exec(merchantRef.trim());
  if (!match) return null;
  return {
    payrollRunId: match[1],
    payrollItemId: match[2],
    retryAttempt: match[3] ? Number(match[3]) : 0,
  };
}

export function isPayrollMerchantRef(merchantRef: string): boolean {
  return PAYROLL_MERCHANT_REF_PATTERN.test(merchantRef.trim());
}
