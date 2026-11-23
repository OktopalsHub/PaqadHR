import { randomUUID } from 'node:crypto';

import type { DataSource } from 'typeorm';

import { PayrollItemStatus } from '../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../common/enums/payroll-status.enum';
import { PayrollItem } from '../modules/v1/payroll/entities/payroll-item.entity';
import { PayrollRun } from '../modules/v1/payroll/entities/payroll-run.entity';
import { RunWriteOps } from '../modules/v1/payroll/services/run-write.ops';
import { createPgDataSource, PG_TEST_URL } from './pg-harness';

const maybe = PG_TEST_URL ? describe : describe.skip;

maybe('payroll run edits (real Postgres)', () => {
  jest.setTimeout(180_000);
  let ds: DataSource;
  let ops: RunWriteOps;

  beforeAll(async () => {
    ds = await createPgDataSource();
    ops = new RunWriteOps(
      ds.getRepository(PayrollRun) as never,
      ds.getRepository(PayrollItem) as never,
      { logAdjustmentCalculated: jest.fn().mockResolvedValue(undefined) } as never,
      { getPayrollRun: jest.fn().mockResolvedValue({}) } as never,
    );
  });
  afterAll(async () => {
    await ds?.destroy();
  });

  const audit = { tenantId: 'x', userId: 'u' } as never;

  async function seedRun() {
    const tenantId = randomUUID();
    const id = randomUUID();
    await ds
      .getRepository(PayrollRun)
      .insert({ id, tenantId, status: PayrollStatus.DRAFT, baseCurrency: 'USD', employeeCount: 0 } as never);
    return { tenantId, id };
  }

  const activeItems = (payrollRunId: string) =>
    ds
      .getRepository(PayrollItem)
      .find({ where: { payrollRunId } })
      .then((items) => items.filter((i) => i.status !== PayrollItemStatus.CANCELLED));

  it('adds each employee once when the same edit is submitted concurrently', async () => {
    const { tenantId, id } = await seedRun();
    const members = [randomUUID(), randomUUID(), randomUUID()];

    await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        ops.updatePayrollRun(id, tenantId, { employeeIds: members } as never, audit),
      ),
    );

    const items = await activeItems(id);
    expect(items).toHaveLength(3);
    expect(new Set(items.map((i) => i.memberId))).toEqual(new Set(members));
  });

  it('ends with exactly one of two competing employee lists, never a mix', async () => {
    const { tenantId, id } = await seedRun();
    const a = [randomUUID(), randomUUID()];
    const b = [randomUUID(), randomUUID(), randomUUID()];

    await Promise.allSettled([
      ...Array.from({ length: 4 }, () =>
        ops.updatePayrollRun(id, tenantId, { employeeIds: a } as never, audit),
      ),
      ...Array.from({ length: 4 }, () =>
        ops.updatePayrollRun(id, tenantId, { employeeIds: b } as never, audit),
      ),
    ]);

    const items = await activeItems(id);
    const ids = new Set(items.map((i) => i.memberId));
    const run = await ds.getRepository(PayrollRun).findOneByOrFail({ id });
    expect(items).toHaveLength(ids.size);
    expect([new Set(a), new Set(b)]).toContainEqual(ids);
    expect(run.employeeCount).toBe(ids.size);
  });
});
