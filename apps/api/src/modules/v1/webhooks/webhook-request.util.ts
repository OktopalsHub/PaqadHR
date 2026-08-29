import { Logger } from '@nestjs/common';
import type { Request } from 'express';
import { isPayrollMerchantRef } from '../payroll/utils/payroll-merchant-ref.util';
import { parseTenantIdFromMonnifyWalletTopupOrderRef } from '../rewards/utils/wallet-order-ref.util';

type RawBodyRequest = Request & { rawBody?: Buffer };
const monnifyWalletWebhookLogger = new Logger('MonnifyWalletWebhook');

export function getNombaRawBody(req: RawBodyRequest): string {
  return req.rawBody?.toString('utf8') ?? '';
}

export function resolveNombaSignature(headers: Record<string, string | undefined>): string {
  return headers['nomba-signature'] ?? '';
}

export function resolveNombaTimestamp(headers: Record<string, string | undefined>): string {
  return headers['nomba-timestamp'] || '';
}

export function resolveNoahSignature(headers: Record<string, string | undefined>): string {
  return (
    headers['webhook-signature'] ?? headers['x-noah-signature'] ?? headers['x-signature'] ?? ''
  );
}

export function resolveMonnifySignature(headers: Record<string, string | undefined>): string {
  return headers['x-monnify-signature'] ?? headers['monnify-signature'] ?? '';
}

export function resolveFincraSignature(headers: Record<string, string | undefined>): string {
  return headers['signature'] ?? headers['x-fincra-signature'] ?? '';
}

export function extractNombaEventType(payload: unknown): string {
  const body = payload as { event_type?: string; eventType?: string; event?: string };
  return String(body.event_type || body.eventType || body.event || '').toLowerCase();
}

export function extractPayrollMerchantRef(payload: unknown): string | null {
  const body = payload as {
    data?: {
      meta?: { merchantTxRef?: string };
      transaction?: { merchantTxRef?: string };
      order?: { orderMetaData?: { merchantTxRef?: string } };
    };
  };
  const ref =
    body.data?.meta?.merchantTxRef ??
    body.data?.transaction?.merchantTxRef ??
    body.data?.order?.orderMetaData?.merchantTxRef ??
    '';
  return isPayrollMerchantRef(ref) ? ref : null;
}

export function extractNoahPayrollExternalId(payload: unknown): string | null {
  const body = payload as { data?: { externalID?: string; externalId?: string } };
  const ref = body.data?.externalID ?? body.data?.externalId ?? '';
  return isPayrollMerchantRef(ref) ? ref : null;
}

export function isSubscriptionPaymentEvent(eventType: string): boolean {
  return (
    eventType === 'payment_success' ||
    eventType === 'payment_failed' ||
    eventType === 'payment.failure'
  );
}

/** Checkout wallet top-up shares payment_success with subscriptions; route by order meta. */
export function extractWalletTopupCheckout(payload: unknown): {
  tenantId: string;
  orderReference: string;
  amount?: number;
  initiatedByMemberId?: string;
} | null {
  const body = payload as {
    event_type?: string;
    eventType?: string;
    data?: {
      orderReference?: string;
      amount?: number;
      meta?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      externalID?: string;
      order?: {
        orderReference?: string;
        amount?: number;
        orderMetaData?: Record<string, string>;
      };
    };
  };
  const eventType = (body.event_type || body.eventType || '').toLowerCase();
  if (eventType !== 'payment_success') return null;

  const data = body.data;
  const order = data?.order;
  const orderMeta = order?.orderMetaData ?? {};
  const flatMeta = (data?.meta ?? data?.metadata ?? {}) as Record<string, unknown>;
  const billingType = orderMeta.billingType ?? flatMeta.billingType;
  if (billingType !== 'wallet_topup') return null;

  const tenantId = orderMeta.tenantId ?? flatMeta.tenantId;
  const orderReference = order?.orderReference ?? data?.orderReference ?? data?.externalID;
  if (!tenantId || !orderReference) return null;

  const expectedRaw = orderMeta.expectedAmount ?? flatMeta.expectedAmount;
  const expectedAmount =
    expectedRaw !== undefined && expectedRaw !== null && String(expectedRaw).trim() !== ''
      ? Number(expectedRaw)
      : undefined;
  const amountFromOrder = Number(order?.amount ?? data?.amount ?? 0);
  const initiatedByRaw = orderMeta.initiatedByMemberId ?? flatMeta.initiatedByMemberId;
  const initiatedByMemberId =
    initiatedByRaw !== undefined && initiatedByRaw !== null && String(initiatedByRaw).trim() !== ''
      ? String(initiatedByRaw)
      : undefined;

  return {
    tenantId: String(tenantId),
    orderReference: String(orderReference),
    amount: Number.isFinite(expectedAmount) ? expectedAmount : amountFromOrder || undefined,
    initiatedByMemberId,
  };
}

function parseMonnifyMeta(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, String(value ?? '')]),
      );
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') {
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).map(([key, value]) => [
        key,
        String(value ?? ''),
      ]),
    );
  }
  return {};
}

export function extractBachsWalletTopupCheckout(payload: unknown): {
  tenantId: string;
  orderReference: string;
  amount?: number;
  initiatedByMemberId?: string;
} | null {
  const body = payload as {
    type?: string;
    data?: {
      reference?: string;
      amount_paid?: string | number;
      amount?: string | number;
      metadata?: Record<string, string>;
    };
  };
  const eventType = String(body.type ?? '').toLowerCase();
  if (eventType !== 'collection.succeeded') return null;

  const data = body.data ?? {};
  const meta = data.metadata ?? {};
  if (meta.billingType !== 'wallet_topup') return null;

  const tenantId = String(meta.tenantId ?? '').trim();
  const orderReference = String(data.reference ?? '').trim();
  if (!tenantId || !orderReference) return null;

  const expectedRaw = meta.expectedAmount;
  // collection.succeeded uses data.amount (not amount_paid).
  const amount = Number(expectedRaw ?? data.amount ?? data.amount_paid ?? 0);
  const initiatedByMemberId = String(meta.initiatedByMemberId ?? '').trim();
  return {
    tenantId,
    orderReference,
    amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
    initiatedByMemberId: initiatedByMemberId || undefined,
  };
}

export function extractMonnifyWalletTopupCheckout(payload: unknown): {
  tenantId: string;
  orderReference: string;
  amount?: number;
  initiatedByMemberId?: string;
} | null {
  const body = payload as {
    eventType?: string;
    eventData?: {
      paymentReference?: string;
      amountPaid?: number | string;
      metaData?: unknown;
    };
  };
  const eventType = String(body.eventType ?? '').toUpperCase();
  if (eventType !== 'SUCCESSFUL_TRANSACTION' && eventType !== 'OVERPAID_TRANSACTION') {
    return null;
  }
  const data = body.eventData ?? {};
  const orderReference = String(data.paymentReference ?? '').trim();
  if (!orderReference) {
    return null;
  }

  const meta = parseMonnifyMeta(data.metaData);
  const fromMeta = meta.billingType === 'wallet_topup';
  const looksLikeWalletRef = /^wm_[0-9a-f]{32}_/i.test(orderReference);
  if (!fromMeta && !looksLikeWalletRef) {
    return null;
  }

  const tenantId =
    (meta.tenantId || '').trim() ||
    (looksLikeWalletRef ? parseTenantIdFromMonnifyWalletTopupOrderRef(orderReference) : null) ||
    '';

  if (!tenantId) {
    return null;
  }

  if (!fromMeta && looksLikeWalletRef) {
    monnifyWalletWebhookLogger.warn(
      `Monnify wallet top-up inferred from wm_ ref (meta billingType missing): ${orderReference}`,
    );
  }

  const amount = Number(data.amountPaid ?? meta.expectedAmount ?? 0);
  return {
    tenantId,
    orderReference,
    amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
    initiatedByMemberId: meta.initiatedByMemberId || undefined,
  };
}

export function extractMonnifySubscriptionPayment(payload: unknown): boolean {
  const body = payload as {
    eventType?: string;
    eventData?: { metaData?: unknown; product?: { reference?: string } };
  };
  const eventType = String(body.eventType ?? '').toUpperCase();
  if (eventType !== 'SUCCESSFUL_TRANSACTION' && eventType !== 'OVERPAID_TRANSACTION') {
    return false;
  }
  const meta = parseMonnifyMeta(body.eventData?.metaData);
  return meta.billingType === 'subscription' && Boolean(meta.tenantId);
}

/** Payroll NGN disbursements use stable payroll_{runId}_{itemId} references. */
export function extractMonnifyPayrollTransfer(payload: unknown): {
  merchantRef: string;
  transactionId: string;
  status: string;
  amount?: number;
} | null {
  const body = payload as {
    eventType?: string;
    eventData?: {
      paymentReference?: string;
      transactionReference?: string;
      reference?: string;
      amountPaid?: number | string;
      amount?: number | string;
      paymentStatus?: string;
      status?: string;
      metaData?: unknown;
    };
  };
  const eventType = String(body.eventType ?? '').toUpperCase();
  const data = body.eventData ?? {};
  const meta = parseMonnifyMeta(data.metaData);
  const candidates = [
    meta.merchantTxRef,
    meta.reference,
    data.paymentReference,
    data.reference,
    data.transactionReference,
  ]
    .filter(Boolean)
    .map(String);
  const merchantRef = candidates.find((ref) => isPayrollMerchantRef(ref));
  if (!merchantRef) {
    return null;
  }

  let status = String(data.status ?? data.paymentStatus ?? 'PENDING').toUpperCase();
  if (eventType.includes('SUCCESS')) {
    status = 'SUCCESS';
  } else if (eventType.includes('FAIL') || eventType.includes('REVERS')) {
    status = 'FAILED';
  }

  const amountRaw = Number(data.amount ?? data.amountPaid ?? meta.amount ?? NaN);
  return {
    merchantRef,
    transactionId: String(
      data.transactionReference ?? data.reference ?? data.paymentReference ?? merchantRef,
    ),
    status,
    amount: Number.isFinite(amountRaw) ? amountRaw : undefined,
  };
}
