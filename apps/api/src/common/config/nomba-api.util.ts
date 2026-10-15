/**
 * Nomba success / accepted codes:
 * - `00` — sync success (most endpoints)
 * - `200` — success on some transfer responses
 * - `202` — accepted / processing (airtime, async ops)
 */
export function isNombaAcceptedCode(code?: string | number | null): boolean {
  if (code === undefined || code === null || code === '') {
    return false;
  }
  const normalized = String(code).trim();
  return normalized === '00' || normalized === '200' || normalized === '202';
}

/** True when status text indicates Nomba accepted or completed the request. */
export function isNombaAcceptedStatus(status?: string | null): boolean {
  if (!status) {
    return false;
  }
  const s = status.toUpperCase();
  return (
    s.includes('SUCCESS') ||
    s.includes('PROCESS') ||
    s.includes('PENDING') ||
    s === 'COMPLETED' ||
    s === 'OK'
  );
}

/** Parse Nomba money fields (number or decimal string). */
export function parseNombaAmount(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

const NOMBA_CHECKOUT_SUCCESS_STATUSES = new Set([
  'success',
  'successful',
  'succeeded',
  'accepted',
  'payment_successful',
  'payment successful',
]);

/** Checkout / verify success — avoid `includes('success')` (matches unsuccessful). */
export function isNombaCheckoutPaymentSuccessful(input: {
  status?: string | null;
  successFlag?: boolean | null;
  message?: string | null;
}): boolean {
  if (input.successFlag === true) return true;
  const status = (input.status ?? '').trim().toLowerCase();
  if (status && NOMBA_CHECKOUT_SUCCESS_STATUSES.has(status)) return true;
  const message = (input.message ?? '').trim().toLowerCase();
  return message === 'payment successful' || message === 'payment_successful';
}

/** Prefer order amount over net wallet credit (fees). */
export function resolveNombaVerifiedCheckoutAmount(data: {
  amount?: unknown;
  onlineCheckoutAmount?: unknown;
  order?: { amount?: unknown };
}): number | undefined {
  return (
    parseNombaAmount(data.order?.amount) ??
    parseNombaAmount(data.onlineCheckoutAmount) ??
    parseNombaAmount(data.amount)
  );
}

/** Checkout create path. Env is the host (sandbox.nomba.com vs api.nomba.com), not the path. */
export function nombaCheckoutOrderPath(_isLive?: boolean): string {
  return '/v1/checkout/order';
}

/**
 * Create-order path candidates. Prefer `/v1/checkout/order` on both hosts (current Nomba guides).
 * Fall back to legacy `/sandbox/checkout/order` when the sandbox host still exposes it.
 */
export function nombaCheckoutOrderPathCandidates(isLive: boolean): string[] {
  if (isLive) return ['/v1/checkout/order'];
  return ['/v1/checkout/order', '/sandbox/checkout/order'];
}

/** @deprecated Prefer transactions/accounts/single or `/v1/checkout/transaction` on the sandbox host. */
export function nombaSandboxCheckoutTransactionPath(orderReference: string): string {
  const params = new URLSearchParams({
    idType: 'orderReference',
    id: orderReference,
  });
  return `/sandbox/checkout/transaction?${params.toString()}`;
}

export function nombaCheckoutTransactionPath(orderReference: string): string {
  const params = new URLSearchParams({
    idType: 'ORDER_REFERENCE',
    id: orderReference,
  });
  return `/v1/checkout/transaction?${params.toString()}`;
}

export function isNombaOperationSuccessful(options: {
  code?: string | number | null;
  status?: string | null;
}): boolean {
  if (isNombaAcceptedCode(options.code)) {
    return true;
  }
  return isNombaAcceptedStatus(options.status);
}

/**
 * Resolve token cache expiry from Nomba token payload.
 * Docs return `expiresAt` (ISO) and tokens last ~30 minutes.
 */
export function resolveNombaTokenExpiresAtMs(data?: {
  expires_in?: number;
  expiresAt?: string;
  expires_at?: string;
}): number {
  const bufferMs = 5 * 60 * 1000;
  const expiresAtRaw = data?.expiresAt || data?.expires_at;
  if (expiresAtRaw) {
    const parsed = Date.parse(expiresAtRaw);
    if (!Number.isNaN(parsed)) {
      return Math.max(Date.now() + 30_000, parsed - bufferMs);
    }
  }

  const expiresInSec = data?.expires_in;
  if (typeof expiresInSec === 'number' && expiresInSec > 0) {
    return Date.now() + expiresInSec * 1000 - bufferMs;
  }

  // Nomba access tokens expire in ~30 minutes; refresh 5 minutes early.
  return Date.now() + 25 * 60 * 1000;
}
