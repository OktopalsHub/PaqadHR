/** Parse ACCESS_EXPIRES_IN-style duration strings to milliseconds. Returns null when invalid. */
export function parseDurationToMs(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    return n >= 10000 ? n : n * 1000;
  }
  // Reject mixed-case suffixes — must match runtime env.config normalization
  if (trimmed !== trimmed.toLowerCase()) {
    return null;
  }
  const match = trimmed.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 1) return null;
  const mult: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * (mult[match[2]] ?? 0);
}

/** Normalize/validate JWT duration env strings (`15m`, `7d`). Throws on invalid configured values. */
export function resolveJwtDurationString(
  raw: string | undefined,
  fallback: `${number}${'s' | 'm' | 'h' | 'd'}`,
): string {
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;
  const normalized = trimmed.toLowerCase();
  // Refresh/session must use unit suffixes — bare numbers are ambiguous (ms vs seconds).
  if (!/^\d+(s|m|h|d)$/.test(normalized) || parseDurationToMs(normalized) == null) {
    throw new Error(
      `Invalid JWT duration "${trimmed}". Use a positive value with unit s|m|h|d (e.g. 15m, 7d).`,
    );
  }
  return normalized;
}

/** Validate refresh/session TTLs and enforce session ≥ refresh. */
export function resolveRefreshAndSessionExpiresIn(
  refreshRaw = process.env.REFRESH_EXPIRES_IN,
  sessionRaw = process.env.SESSION_EXPIRES_IN,
): { REFRESH_EXPIRES_IN: string; SESSION_EXPIRES_IN: string } {
  const refresh = resolveJwtDurationString(refreshRaw, '7d');
  const session = resolveJwtDurationString(sessionRaw ?? refreshRaw, '7d');
  const refreshMs = parseDurationToMs(refresh);
  const sessionMs = parseDurationToMs(session);
  if (refreshMs === null || sessionMs === null) {
    throw new Error('REFRESH_EXPIRES_IN / SESSION_EXPIRES_IN must be valid durations');
  }
  if (sessionMs < refreshMs) {
    throw new Error(
      `SESSION_EXPIRES_IN (${session}) must be greater than or equal to REFRESH_EXPIRES_IN (${refresh})`,
    );
  }
  return { REFRESH_EXPIRES_IN: refresh, SESSION_EXPIRES_IN: session };
}
