/** Parse ACCESS_EXPIRES_IN-style duration strings to milliseconds. Returns null when invalid. */
export function parseDurationToMs(raw: string): number | null {
  const trimmed = raw.trim();
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
  const mult: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(match[1]) * (mult[match[2]] ?? 0);
}
