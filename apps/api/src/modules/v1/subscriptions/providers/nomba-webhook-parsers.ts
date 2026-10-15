import { parseBillingChargeType } from '../constants/billing.constants';
import type {
  SubscriptionBillingMetadata,
  SubscriptionWebhookEvent,
} from '../interfaces/subscription-billing.interface';

interface NombaWebhookPayload {
  event_type?: string;
  eventType?: string;
  data?: {
    orderReference?: string;
    amount?: number;
    currency?: string;
    customerEmail?: string;
    status?: string;
    tokenizedCardData?: {
      tokenKey?: string;
      cardType?: string;
      cardPan?: string;
    };
    meta?: SubscriptionBillingMetadata;
    order?: {
      orderReference?: string;
      customerEmail?: string;
      amount?: number;
      currency?: string;
      orderMetaData?: Record<string, string>;
    };
    transaction?: {
      transactionId?: string;
      merchantTxRef?: string;
      transactionAmount?: number;
      time?: string;
    };
  };
}

function parseTokenizedCard(data?: { cardType?: string; cardPan?: string }): {
  cardBrand?: string;
  cardLastFour?: string;
} {
  if (!data) return {};
  const digits = (data.cardPan ?? '').replace(/\D/g, '');
  return {
    cardBrand: data.cardType?.trim() || undefined,
    cardLastFour: digits.length >= 4 ? digits.slice(-4) : undefined,
  };
}

function extractMeta(orderMeta: Record<string, string>, dataMeta?: SubscriptionBillingMetadata) {
  return {
    tenantId: orderMeta.tenantId ?? dataMeta?.tenantId,
    planId: orderMeta.planId ?? dataMeta?.planId,
    planPriceId: orderMeta.planPriceId ?? dataMeta?.planPriceId,
    userId: orderMeta.userId ?? dataMeta?.userId,
    tenantMemberId: orderMeta.tenantMemberId ?? dataMeta?.tenantMemberId,
    quantity: orderMeta.quantity ? Number(orderMeta.quantity) : dataMeta?.quantity,
    extraSeats: orderMeta.extraSeats ? Number(orderMeta.extraSeats) : dataMeta?.extraSeats,
    targetSeatCount: orderMeta.targetSeatCount
      ? Number(orderMeta.targetSeatCount)
      : dataMeta?.targetSeatCount,
    billingType: parseBillingChargeType(orderMeta.billingType ?? dataMeta?.billingType),
  };
}

export function parseNombaWebhook(payload: unknown): SubscriptionWebhookEvent | null {
  const body = payload as NombaWebhookPayload;
  const eventType = (body.event_type || body.eventType || '').toLowerCase();

  if (eventType === 'payment_success') {
    const data = body.data;
    const order = data?.order;
    const orderMeta = order?.orderMetaData ?? {};
    const meta = extractMeta(orderMeta, data?.meta);
    const reference = order?.orderReference ?? data?.orderReference;
    if (!reference || !meta.tenantId) {
      return null;
    }

    const card = parseTokenizedCard(data?.tokenizedCardData);
    const targetSeatCount = meta.targetSeatCount ?? meta.quantity;

    return {
      kind: 'payment.success',
      payment: {
        eventId: data?.transaction?.transactionId || reference,
        reference,
        tenantId: String(meta.tenantId),
        planId: meta.planId ? String(meta.planId) : undefined,
        planPriceId: meta.planPriceId ? String(meta.planPriceId) : undefined,
        quantity: targetSeatCount ? Number(targetSeatCount) : undefined,
        extraSeats: meta.extraSeats ? Number(meta.extraSeats) : undefined,
        targetSeatCount: targetSeatCount ? Number(targetSeatCount) : undefined,
        amount: Number(order?.amount ?? data?.amount ?? data?.transaction?.transactionAmount ?? 0),
        currency: (order?.currency ?? data?.currency ?? 'NGN').toUpperCase(),
        tokenKey: data?.tokenizedCardData?.tokenKey,
        customerEmail: order?.customerEmail ?? data?.customerEmail,
        status: data?.status || 'success',
        billingType: parseBillingChargeType(meta.billingType),
        ...card,
      },
    };
  }

  if (eventType === 'payment_failed' || eventType === 'payment.failure') {
    const data = body.data;
    const order = data?.order;
    const orderMeta = order?.orderMetaData ?? {};
    const meta = extractMeta(orderMeta, data?.meta);
    const reference = order?.orderReference ?? data?.orderReference;
    if (!reference || !meta.tenantId) {
      return null;
    }

    return {
      kind: 'payment.failed',
      payment: {
        eventId: data?.transaction?.transactionId || reference,
        reference,
        tenantId: String(meta.tenantId),
        planId: meta.planId ? String(meta.planId) : undefined,
        planPriceId: meta.planPriceId ? String(meta.planPriceId) : undefined,
        quantity: meta.quantity ? Number(meta.quantity) : undefined,
        amount: Number(order?.amount ?? data?.amount ?? data?.transaction?.transactionAmount ?? 0),
        currency: (order?.currency ?? data?.currency ?? 'NGN').toUpperCase(),
        customerEmail: order?.customerEmail ?? data?.customerEmail,
        status: data?.status || 'failed',
        billingType: parseBillingChargeType(meta.billingType),
      },
    };
  }

  return { kind: 'ignored', event: eventType || 'unknown' };
}
