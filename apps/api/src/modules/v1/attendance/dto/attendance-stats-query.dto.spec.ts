import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AttendanceStatsQueryDto } from './attendance-stats-query.dto';

const errors = (o: object) => validate(plainToInstance(AttendanceStatsQueryDto, o));

describe('AttendanceStatsQueryDto', () => {
  it('accepts real dates and no dates', async () => {
    expect(await errors({ startDate: '2026-03-01', endDate: '2026-03-31' })).toHaveLength(0);
    expect(await errors({})).toHaveLength(0);
  });
  it('rejects impossible dates', async () => {
    expect((await errors({ startDate: '2026-02-31' })).length).toBeGreaterThan(0);
    expect((await errors({ endDate: 'nonsense' })).length).toBeGreaterThan(0);
  });
});
