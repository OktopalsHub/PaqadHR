export type CalendarFetchWindow = { from: string; to: string };

const MONTHS_EACH_SIDE = 2;

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Whole months around the focused date, so a few month changes need no new request. */
export function calendarWindowForDate(focus: Date): CalendarFetchWindow {
  const from = new Date(focus.getFullYear(), focus.getMonth() - MONTHS_EACH_SIDE, 1);
  const to = new Date(focus.getFullYear(), focus.getMonth() + MONTHS_EACH_SIDE + 1, 0);
  return { from: dateKey(from), to: dateKey(to) };
}

/**
 * Keeps the current window while the visible range sits inside it, and recenters on
 * the focused date once the user navigates past it. `visibleEnd` is exclusive.
 */
export function nextCalendarWindow(
  current: CalendarFetchWindow,
  visible: { start: Date; end: Date },
  focus: Date,
): CalendarFetchWindow {
  const lastVisibleDay = new Date(visible.end.getTime() - 1);
  if (dateKey(visible.start) >= current.from && dateKey(lastVisibleDay) <= current.to) {
    return current;
  }
  return calendarWindowForDate(focus);
}
