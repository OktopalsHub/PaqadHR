import type { PaymentMethod } from '../entities/payment-method.entity';

type SafeField =
  | 'id'
  | 'tenantId'
  | 'memberId'
  | 'type'
  | 'currency'
  | 'bankName'
  | 'bankCode'
  | 'country'
  | 'isPrimary'
  | 'status'
  | 'displayName'
  | 'verifiedAt'
  | 'submittedAt'
  | 'verificationNotes'
  | 'lastUsedAt'
  | 'metadata'
  | 'createdAt'
  | 'updatedAt';

export type PaymentMethodResponse = Pick<PaymentMethod, SafeField> & {
  accountName: string | null;
  accountNumber: string | null;
};

export function maskAccountNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length > 4 ? `${'*'.repeat(value.length - 4)}${value.slice(-4)}` : '****';
}

export function toPaymentMethodResponse(
  method: PaymentMethod | null,
  decrypt: (value: string | null) => string | null | undefined,
): PaymentMethodResponse | null {
  if (!method) return null;
  const safe = {
    id: method.id,
    tenantId: method.tenantId,
    memberId: method.memberId,
    type: method.type,
    currency: method.currency,
    bankName: method.bankName,
    bankCode: method.bankCode,
    country: method.country,
    isPrimary: method.isPrimary,
    status: method.status,
    displayName: method.displayName,
    verifiedAt: method.verifiedAt,
    submittedAt: method.submittedAt,
    verificationNotes: method.verificationNotes,
    lastUsedAt: method.lastUsedAt,
    metadata: method.metadata,
    createdAt: method.createdAt,
    updatedAt: method.updatedAt,
  };
  return {
    ...safe,
    accountName: decrypt(method.accountName) ?? null,
    accountNumber: maskAccountNumber(decrypt(method.accountNumber)),
  };
}
