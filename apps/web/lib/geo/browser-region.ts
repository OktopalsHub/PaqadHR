export function getBrowserTimezone(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}
