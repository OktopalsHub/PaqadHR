import type { Repository } from 'typeorm';

import { TenantCounter } from '../entities/tenant-counter.entity';
import { TenantCounterRepository } from './tenant-counter.repository';

describe('TenantCounterRepository.nextValue', () => {
  it('upserts and increments in one statement and returns the new value', async () => {
    const query = jest.fn().mockResolvedValue([{ current_value: '5' }]);
    const base = {
      target: TenantCounter,
      manager: {},
      queryRunner: undefined,
      query,
    } as unknown as Repository<TenantCounter>;
    const repository = new TenantCounterRepository(base);

    const value = await repository.nextValue('tenant-1', 'employee_number', {
      prefix: 'E',
      paddingLength: 4,
    });

    expect(value).toBe(5);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('ON CONFLICT ("tenant_id", "counter_type")');
    expect(sql).toContain('"current_value" + 1');
    expect(sql).toContain('RETURNING "current_value"');
    expect(params.slice(1)).toEqual(['tenant-1', 'employee_number', 'E', null, 4]);
  });
});
