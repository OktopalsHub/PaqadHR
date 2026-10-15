export type BillingFailureCode =
  | 'insufficient_funds'
  | 'card_expired'
  | 'authentication_required'
  | 'verification_failed'
  | 'unknown';

const FAILURE_MESSAGES: Record<BillingFailureCode, string> = {
  insufficient_funds: 'Card declined — insufficient funds',
  card_expired: 'Card expired — update payment method',
  authentication_required: 'Bank requires additional verification',
  verification_failed: 'Payment could not be confirmed',
  unknown: 'Payment failed — try again or update card',
};

export function mapNombaBillingFailure(raw: string | undefined | null): {
  code: BillingFailureCode;
  message: string;
} {
  const text = (raw ?? '').toLowerCase();

  if (
    text.includes('insufficient') ||
    text.includes('not sufficient') ||
    text.includes('declined')
  ) {
    return { code: 'insufficient_funds', message: FAILURE_MESSAGES.insufficient_funds };
  }
  if (text.includes('expired') || text.includes('expir')) {
    return { code: 'card_expired', message: FAILURE_MESSAGES.card_expired };
  }
  if (
    text.includes('authentication') ||
    text.includes('otp') ||
    text.includes('3ds') ||
    text.includes('authorize')
  ) {
    return {
      code: 'authentication_required',
      message: FAILURE_MESSAGES.authentication_required,
    };
  }
  if (text.includes('verification_failed') || text.includes('verify')) {
    return { code: 'verification_failed', message: FAILURE_MESSAGES.verification_failed };
  }
  if (text.includes('renewal_payment_failed')) {
    return { code: 'unknown', message: FAILURE_MESSAGES.unknown };
  }

  return { code: 'unknown', message: FAILURE_MESSAGES.unknown };
}

export function getBillingFailureMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  const key = code as BillingFailureCode;
  return FAILURE_MESSAGES[key] ?? FAILURE_MESSAGES.unknown;
}
