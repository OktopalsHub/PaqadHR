import { randomBytes } from 'node:crypto';
import { PaymentProvider } from '../../../../common/enums/payment-provider.enum';

export type PayrollFloatOrderRefProvider =
  | PaymentProvider.MONNIFY
  | PaymentProvider.NOMBA
  | PaymentProvider.NOAH
  | PaymentProvider.FINCRA;

/** Distinct from rewards wallet prefixes (wt_/wm_/nw_/wf_/wb_). */
const PAYROLL_FLOAT_ORDER_REF_PREFIX: Record<PayrollFloatOrderRefProvider, string> = {
  [PaymentProvider.NOMBA]: 'pn',
  [PaymentProvider.MONNIFY]: 'py',
  [PaymentProvider.FINCRA]: 'pf',
  [PaymentProvider.NOAH]: 'po',
};

const PAYROLL_FLOAT_ORDER_REF_MAX_LENGTH: Record<PayrollFloatOrderRefProvider, number> = {
  [PaymentProvider.NOMBA]: 50,
  [PaymentProvider.MONNIFY]: 80,
  [PaymentProvider.FINCRA]: 80,
  [PaymentProvider.NOAH]: 80,
};

const TARGET_ENTROPY_BITS = 64;

function tenantKeyFromId(tenantId: string): string {
  return tenantId.replace(/-/g, '');
}

function uuidFromHex32(hex: string): string {
  const normalized = hex.toLowerCase();
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

export function buildPayrollFloatOrderRef(
  provider: PayrollFloatOrderRefProvider,
  tenantId: string,
): string {
  const prefix = PAYROLL_FLOAT_ORDER_REF_PREFIX[provider];
  const maxLength = PAYROLL_FLOAT_ORDER_REF_MAX_LENGTH[provider];
  const tenantKey = tenantKeyFromId(tenantId);
  const base = `${prefix}_${tenantKey}_`;
  const timestamp = Date.now().toString(36);
  const suffixBudget = maxLength - base.length - timestamp.length;
  const targetHexChars = TARGET_ENTROPY_BITS / 4;
  const hexChars = Math.max(0, Math.min(targetHexChars, suffixBudget));
  const randomHex = randomBytes(Math.ceil(hexChars / 2))
    .toString('hex')
    .slice(0, hexChars);
  const ref = `${base}${timestamp}${randomHex}`;
  if (ref.length > maxLength) {
    throw new Error(`Payroll float order reference exceeds ${maxLength} chars for ${provider}`);
  }
  return ref;
}

export function parseTenantIdFromPayrollFloatOrderRef(orderReference: string): string | null {
  const match = /^(pn|py|pf|po)_([0-9a-f]{32})_/i.exec(orderReference.trim());
  if (!match) return null;
  return uuidFromHex32(match[2]);
}

export function isPayrollFloatOrderRef(orderReference: string): boolean {
  return /^(pn|py|pf|po)_[0-9a-f]{32}_/i.test(orderReference.trim());
}
