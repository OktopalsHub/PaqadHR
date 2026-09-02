import { createHmac, timingSafeEqual } from 'node:crypto';
import { isPayrollMerchantRef } from '../../modules/v1/payroll/utils/payroll-merchant-ref.util';
import { parseTenantIdFromFincraWalletTopupOrderRef } from '../../modules/v1/rewards/utils/wallet-order-ref.util';
import { getFincraWebhookSecret } from './fincra.config';

export interface FincraParsedPayoutWebhook {
  merchantRef: string;
  reference: string;
  status: string;
  amount?: number;
}

export interface FincraParsedPayinWebhook {
  merchantReference: string;
  reference: string;
  status: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}

function signaturesMatch(expected: string, received: string): boolean {
  try {
    const a = Buffer.from(expected.toLowerCase(), 'utf8');
    const b = Buffer.from(received.toLowerCase(), 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Fincra signs JSON.stringify(parsedPayload) with HMAC-SHA512. */
export function verifyFincraWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = getFincraWebhookSecret();
  const normalizedSignature = signature.trim().toLowerCase();
  if (!secret || !normalizedSignature) {
    return false;
  }

  try {
    const payload = JSON.parse(rawBody) as unknown;
    const compact = JSON.stringify(payload);
    const hmacDigest = createHmac('sha512', secret).update(compact).digest('hex');
    if (signaturesMatch(hmacDigest, normalizedSignature)) {
      return true;
    }
  } catch {}

  try {
    const hmacRaw = createHmac('sha512', secret).update(rawBody).digest('hex');
    return signaturesMatch(hmacRaw, normalizedSignature);
  } catch {
    return false;
  }
}

export function parseFincraPayoutWebhook(payload: unknown): FincraParsedPayoutWebhook | null {
  const body = payload as {
    event?: string;
    data?: {
      customerReference?: string;
      reference?: string;
      status?: string;
      amountReceived?: number;
      amountCharged?: number;
    };
  };

  const event = (body.event ?? '').toLowerCase();
  if (!event.startsWith('payout.')) {
    return null;
  }

  const data = body.data;
  const merchantRef = data?.customerReference?.trim() ?? '';
  if (!merchantRef || !isPayrollMerchantRef(merchantRef)) {
    return null;
  }

  return {
    merchantRef,
    reference: data?.reference ?? merchantRef,
    status: data?.status ?? event.replace('payout.', ''),
    amount: data?.amountReceived ?? data?.amountCharged,
  };
}

export function parseFincraPayinWebhook(payload: unknown): FincraParsedPayinWebhook | null {
  const body = payload as {
    event?: string;
    data?: {
      reference?: string;
      status?: string;
      amount?: number;
      amountReceived?: number;
      metadata?: Record<string, unknown>;
      merchantReference?: string;
    };
  };

  const event = (body.event ?? '').toLowerCase();
  if (!event.startsWith('charge.')) {
    return null;
  }

  const data = body.data;
  const metadata = data?.metadata ?? {};
  const billingType = metadata.billingType ?? metadata.billing_type;
  if (billingType !== 'wallet_topup') {
    return null;
  }

  const merchantReference =
    (typeof metadata.orderReference === 'string' ? metadata.orderReference : undefined) ??
    data?.merchantReference ??
    '';
  if (!merchantReference.trim()) {
    return null;
  }

  return {
    merchantReference: merchantReference.trim(),
    reference: data?.reference ?? merchantReference,
    status: data?.status ?? event.replace('charge.', ''),
    amount: data?.amountReceived ?? data?.amount,
    metadata,
  };
}

export function extractFincraWalletTopupCheckout(payload: unknown): {
  tenantId: string;
  orderReference: string;
  amount?: number;
  initiatedByMemberId?: string;
} | null {
  const parsed = parseFincraPayinWebhook(payload);
  if (!parsed) return null;

  const meta = parsed.metadata ?? {};
  let tenantId = meta.tenantId ?? meta.tenant_id;
  if (!tenantId) {
    const fromRef = parseTenantIdFromFincraWalletTopupOrderRef(parsed.merchantReference);
    if (fromRef) tenantId = fromRef;
  }
  if (!tenantId) return null;

  const expectedRaw = meta.expectedAmount ?? meta.expected_amount;
  const expectedAmount =
    expectedRaw !== undefined && expectedRaw !== null && String(expectedRaw).trim() !== ''
      ? Number(expectedRaw)
      : undefined;
  const initiatedByRaw = meta.initiatedByMemberId ?? meta.initiated_by_member_id;

  return {
    tenantId: String(tenantId),
    orderReference: parsed.merchantReference,
    amount: Number.isFinite(expectedAmount) ? expectedAmount : parsed.amount,
    initiatedByMemberId:
      initiatedByRaw !== undefined &&
      initiatedByRaw !== null &&
      String(initiatedByRaw).trim() !== ''
        ? String(initiatedByRaw)
        : undefined,
  };
}
