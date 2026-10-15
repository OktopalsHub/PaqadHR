import assert from 'node:assert/strict';
import test from 'node:test';
import { getCalendarEventsQueryEnabled } from './calendar-query-enabled.ts';

test('calendar query respects an explicit disabled option', () => {
  assert.equal(
    getCalendarEventsQueryEnabled({
      enabled: false,
      tenantId: 'tenant-1',
      tenantLoading: false,
    }),
    false,
  );
});

test('calendar query stays disabled until tenant context is ready', () => {
  assert.equal(
    getCalendarEventsQueryEnabled({
      enabled: true,
      tenantId: null,
      tenantLoading: false,
    }),
    false,
  );
  assert.equal(
    getCalendarEventsQueryEnabled({
      enabled: true,
      tenantId: 'tenant-1',
      tenantLoading: true,
    }),
    false,
  );
});
