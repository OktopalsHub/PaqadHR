/** Soft-lock after this much idle time (absolute session remains until refresh expires). */
export const IDLE_LOCK_MS = 8 * 60 * 60 * 1000;

const STORAGE_KEY = 'paqad_idle_lock';
const ACTIVITY_KEY = 'paqad_last_activity_at';

export type IdleLockState = {
  email: string;
  hasPassword: boolean;
};

export function readLastActivityAt(now = Date.now()): number {
  if (typeof window === 'undefined') return now;
  const raw = window.sessionStorage.getItem(ACTIVITY_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : now;
}

export function touchLastActivity(now = Date.now()): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ACTIVITY_KEY, String(now));
}

export function isIdlePastThreshold(
  now = Date.now(),
  idleMs = IDLE_LOCK_MS,
  lastActivityAt = readLastActivityAt(now),
): boolean {
  return now - lastActivityAt >= idleMs;
}

export function readIdleLock(): IdleLockState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IdleLockState;
    if (!parsed?.email || typeof parsed.hasPassword !== 'boolean') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeIdleLock(state: IdleLockState): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearIdleLock(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
