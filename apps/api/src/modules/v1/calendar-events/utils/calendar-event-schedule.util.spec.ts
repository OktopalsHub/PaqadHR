import {
  eventStartAtUtc,
  formatReminderLeadLabel,
  isReminderDue,
  reminderAtUtc,
} from './calendar-event-schedule.util';

describe('calendar-event-schedule.util', () => {
  const baseEvent = {
    startDate: '2026-06-18',
    endDate: '2026-06-18',
    allDay: false,
    startTime: '10:00:00',
    reminderMinutes: 15,
  };

  it('computes reminder time before timed event start', () => {
    const startAt = eventStartAtUtc(baseEvent, 'UTC');
    const reminderAt = reminderAtUtc(baseEvent, 'UTC');

    expect(startAt.toISOString()).toBe('2026-06-18T10:00:00.000Z');
    expect(reminderAt?.toISOString()).toBe('2026-06-18T09:45:00.000Z');
  });

  it('uses default morning time for all-day events', () => {
    const startAt = eventStartAtUtc(
      { ...baseEvent, allDay: true, startTime: null },
      'UTC',
    );

    expect(startAt.toISOString()).toBe('2026-06-18T09:00:00.000Z');
  });

  it('detects reminder window', () => {
    const startAt = eventStartAtUtc(baseEvent, 'UTC');
    const reminderAt = reminderAtUtc(baseEvent, 'UTC')!;
    const now = new Date('2026-06-18T09:46:00.000Z');

    expect(isReminderDue(reminderAt, startAt, now)).toBe(true);
    expect(isReminderDue(reminderAt, startAt, new Date('2026-06-18T10:05:00.000Z'))).toBe(false);
  });

  it('formats reminder lead labels', () => {
    expect(formatReminderLeadLabel(0)).toBe('starting now');
    expect(formatReminderLeadLabel(15)).toBe('in 15 minutes');
    expect(formatReminderLeadLabel(1440)).toBe('tomorrow');
  });
});
