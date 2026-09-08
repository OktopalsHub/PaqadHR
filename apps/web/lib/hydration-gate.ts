/** Shared shell height so calendar loading skeletons match the hydrated view. */
export const CALENDAR_SHELL_HEIGHT_CLASS = 'h-[min(72vh,760px)] min-h-[520px]';

/** Pure gate used by hydration placeholders (calendar/admin/employee). */
export function shouldShowHydrationPlaceholder(hasHydrated: boolean, isLoading = false): boolean {
  return !hasHydrated || isLoading;
}
