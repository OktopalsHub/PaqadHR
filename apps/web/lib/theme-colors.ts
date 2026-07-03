/** Fallback when CSS vars are unavailable (SSR / first paint). Keep in sync with --brand in globals.css. */
export const DEFAULT_BRAND_COLOR = '#00c389';

export function readCssVariable(name: string, fallback = DEFAULT_BRAND_COLOR): string {
  if (typeof document === 'undefined') {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function readBrandColor(): string {
  return readCssVariable('--brand');
}
