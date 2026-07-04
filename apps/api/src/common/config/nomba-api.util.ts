/** Nomba accepts sync success (`00`) and async accepted (`202`). */
export function isNombaAcceptedCode(code?: string | number | null): boolean {
  if (code === undefined || code === null || code === '') {
    return false;
  }
  const normalized = String(code).trim();
  return normalized === '00' || normalized === '202';
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
