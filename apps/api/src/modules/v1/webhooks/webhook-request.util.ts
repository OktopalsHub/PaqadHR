import type { Request } from 'express';

type RawBodyRequest = Request & { rawBody?: Buffer };

const PAYROLL_REF_PATTERN = /^payroll_([0-9a-f-]{36})_([0-9a-f-]{36})$/i;

export function getNombaRawBody(req: RawBodyRequest): string {
  return req.rawBody?.toString('utf8') ?? '';
}

export function resolveNombaSignature(headers: Record<string, string | undefined>): string {
  return (
    headers['nomba-signature'] || ''
  );
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
  return PAYROLL_REF_PATTERN.test(ref) ? ref : null;
}

export function isSubscriptionPaymentEvent(eventType: string): boolean {
  return (
    eventType === 'payment_success' ||
    eventType === 'payment_failed' ||
    eventType === 'payment.failure'
  );
}

export function isWalletFundingEvent(eventType: string): boolean {
  return (
    eventType.includes('deposit') ||
    eventType.includes('virtualaccount') ||
    eventType.includes('transfer.success')
  );
}
