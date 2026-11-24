import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { BulkCreateAttendanceDto, ManualAttendanceDto } from './manual-attendance.dto';

const check = (cls: new () => object, plain: object) =>
  validate(plainToInstance(cls, plain), { whitelist: true, forbidNonWhitelisted: true });

const id = '123e4567-e89b-42d3-a456-426614174000';

describe('ManualAttendanceDto', () => {
  const valid = { tenantMemberId: id, date: '2026-01-02T00:00:00.000Z', status: 'PRESENT' };

  it('accepts a valid body', async () => {
    expect(await check(ManualAttendanceDto, valid)).toHaveLength(0);
  });

  it('rejects non-uuid member, bad status, bad dates and unknown fields', async () => {
    for (const bad of [
      { ...valid, tenantMemberId: 'abc' },
      { ...valid, status: 'NOPE' },
      { ...valid, date: 'yesterday' },
      { ...valid, clockIn: 5 },
      { ...valid, tenantId: id },
    ]) {
      expect((await check(ManualAttendanceDto, bad)).length).toBeGreaterThan(0);
    }
  });
});

describe('BulkCreateAttendanceDto', () => {
  const rec = { memberId: id, date: '2026-01-02', status: 'ABSENT' };

  it('accepts valid records', async () => {
    expect(await check(BulkCreateAttendanceDto, { records: [rec] })).toHaveLength(0);
  });

  it('rejects empty, oversized, malformed and unknown-field payloads', async () => {
    for (const bad of [
      { records: [] },
      { records: Array.from({ length: 501 }, () => rec) },
      { records: [{ ...rec, memberId: 'x' }] },
      { records: [{ ...rec, tenantId: id }] },
      { records: [rec], extra: 1 },
      {},
    ]) {
      expect((await check(BulkCreateAttendanceDto, bad)).length).toBeGreaterThan(0);
    }
  });
});
