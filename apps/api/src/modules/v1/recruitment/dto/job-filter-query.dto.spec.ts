import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { JobFilterQueryDto } from './job-filter-query.dto';

const run = (plain: object) => {
  const dto = plainToInstance(JobFilterQueryDto, plain);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true }).then((errors) => ({
    errors,
    dto,
  }));
};

describe('JobFilterQueryDto', () => {
  it('accepts and coerces query-string values', async () => {
    const { errors, dto } = await run({
      status: 'ACTIVE',
      employmentType: 'FULL_TIME',
      isUrgent: 'true',
      page: '2',
      limit: '50',
    });
    expect(errors).toHaveLength(0);
    expect(dto.isUrgent).toBe(true);
    expect(dto.page).toBe(2);
  });

  it('rejects bad enums, ranges, types and unknown fields including tenantId', async () => {
    for (const bad of [
      { status: 'NOPE' },
      { employmentType: 'x' },
      { limit: '1000' },
      { page: '0' },
      { isUrgent: 'maybe' },
      { departmentId: 'x' },
      { search: ['a', 'b'] },
      { tenantId: 'other' },
    ]) {
      expect((await run(bad)).errors.length).toBeGreaterThan(0);
    }
  });
});
