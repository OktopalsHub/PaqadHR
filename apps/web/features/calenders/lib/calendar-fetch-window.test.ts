import assert from 'node:assert/strict';
import test from 'node:test';

import { calendarWindowForDate, nextCalendarWindow } from './calendar-fetch-window.ts';

test('the window spans whole months either side of the focused date', () => {
  assert.deepEqual(calendarWindowForDate(new Date(2026, 10, 20)), {
    from: '2026-09-01',
    to: '2027-01-31',
  });
});

test('navigating inside the window keeps it, so no new request is made', () => {
  const current = calendarWindowForDate(new Date(2026, 10, 20));
  const next = nextCalendarWindow(
    current,
    { start: new Date(2026, 11, 1), end: new Date(2027, 0, 1) },
    new Date(2026, 11, 15),
  );
  assert.equal(next, current);
});

test('navigating past the window recenters on the focused date', () => {
  const current = calendarWindowForDate(new Date(2026, 10, 20));
  const next = nextCalendarWindow(
    current,
    { start: new Date(2027, 1, 1), end: new Date(2027, 2, 1) },
    new Date(2027, 1, 15),
  );
  assert.deepEqual(next, { from: '2026-12-01', to: '2027-04-30' });
});
