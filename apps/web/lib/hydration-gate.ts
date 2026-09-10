export const CALENDAR_SHELL_HEIGHT_CLASS = 'h-[min(72vh,760px)] min-h-[520px]';

export function shouldShowHydrationPlaceholder(hasHydrated: boolean, isLoading = false): boolean {
  return !hasHydrated || isLoading;
}
