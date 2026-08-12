import { computeDunningNextRetryAt, maxDunningAttempts } from './dunning.util';

describe('dunning.util', () => {
  it('schedules first retry two days after the billing anchor', () => {
    const anchor = new Date('2026-01-01T00:00:00.000Z');
    const next = computeDunningNextRetryAt(anchor, 1);
    expect(next?.toISOString()).toBe('2026-01-03T00:00:00.000Z');
  });

  it('spaces subsequent retries without a same-day first reattempt', () => {
    const anchor = new Date('2026-01-01T00:00:00.000Z');
    expect(computeDunningNextRetryAt(anchor, 2)?.toISOString()).toBe('2026-01-05T00:00:00.000Z');
    expect(computeDunningNextRetryAt(anchor, 3)?.toISOString()).toBe('2026-01-07T00:00:00.000Z');
    expect(computeDunningNextRetryAt(anchor, 4)).toBeNull();
  });

  it('max attempts matches configured intervals', () => {
    expect(maxDunningAttempts()).toBe(3);
  });
});
