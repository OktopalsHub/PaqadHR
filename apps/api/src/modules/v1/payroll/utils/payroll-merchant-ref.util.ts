/** Compact Monnify-safe ref (≤64): pi_{itemUuidNoHyphens}[_r{n}] */
const COMPACT_PATTERN = /^pi_([0-9a-f]{32})(?:_r(\d+))?$/i;

/** Legacy long form (Nomba/Fincra/Noah still accept): payroll_{run}_{item}[_r{n}] */
const LEGACY_PATTERN = /^payroll_([0-9a-f-]{36})_([0-9a-f-]{36})(?:_r(\d+))?$/i;

export const PAYROLL_MERCHANT_REF_PATTERN =
  /^(?:pi_[0-9a-f]{32}|payroll_[0-9a-f-]{36}_[0-9a-f-]{36})(?:_r\d+)?$/i;

function uuidFromHex32(hex: string): string {
  const h = hex.toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function uuidToHex32(uuid: string): string {
  return uuid.replace(/-/g, '').toLowerCase();
}

/**
 * Build a payout customer reference.
 * Uses compact `pi_{item}` form so Monnify's 64-char reference limit is never exceeded.
 */
export function buildPayrollMerchantRef(
  _payrollRunId: string,
  payrollItemId: string,
  retryAttempt = 0,
): string {
  const base = `pi_${uuidToHex32(payrollItemId)}`;
  return retryAttempt > 0 ? `${base}_r${retryAttempt}` : base;
}

/** @deprecated Prefer parsePayrollMerchantRef — kept for callers that only need a boolean. */
export function isPayrollMerchantRef(merchantRef: string): boolean {
  return PAYROLL_MERCHANT_REF_PATTERN.test(merchantRef.trim());
}

export function parsePayrollMerchantRef(merchantRef: string): {
  payrollRunId: string | null;
  payrollItemId: string;
  retryAttempt: number;
} | null {
  const value = merchantRef.trim();
  const compact = COMPACT_PATTERN.exec(value);
  if (compact) {
    return {
      payrollRunId: null,
      payrollItemId: uuidFromHex32(compact[1]),
      retryAttempt: compact[2] ? Number(compact[2]) : 0,
    };
  }
  const legacy = LEGACY_PATTERN.exec(value);
  if (legacy) {
    return {
      payrollRunId: legacy[1],
      payrollItemId: legacy[2],
      retryAttempt: legacy[3] ? Number(legacy[3]) : 0,
    };
  }
  return null;
}
