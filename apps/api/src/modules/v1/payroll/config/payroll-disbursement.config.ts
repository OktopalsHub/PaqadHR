export type PayrollDisbursementMode = 'manual' | 'gateway';

export function getPayrollDisbursementMode(): PayrollDisbursementMode {
  const mode = (process.env.PAYROLL_DISBURSEMENT_MODE || 'manual').toLowerCase();
  return mode === 'gateway' ? 'gateway' : 'manual';
}

export function isManualPayrollDisbursement(): boolean {
  return getPayrollDisbursementMode() === 'manual';
}
