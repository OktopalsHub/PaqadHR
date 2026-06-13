import { UnprocessableEntityException } from '@nestjs/common';
import { DateTimeHelper } from './date-time.helpers';

describe('DateTimeHelper (leave duration)', () => {
  it('calculates inclusive day span', () => {
    const result = DateTimeHelper.calculateDuration('2026-03-01', '2026-03-05');
    expect(result.durationInDays).toBe(5);
    expect(result.startDate).toBe('2026-03-01');
    expect(result.endDate).toBe('2026-03-05');
  });

  it('rejects end date before start date', () => {
    expect(() =>
      DateTimeHelper.calculateDuration('2026-03-10', '2026-03-05'),
    ).toThrow(UnprocessableEntityException);
  });

  it('rejects invalid dates', () => {
    expect(() =>
      DateTimeHelper.calculateDuration('not-a-date', '2026-03-05'),
    ).toThrow(UnprocessableEntityException);
  });
});
