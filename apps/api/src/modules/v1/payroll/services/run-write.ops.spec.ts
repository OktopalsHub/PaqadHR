import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { RunWriteOps } from './run-write.ops';

const dto = {
  title: 'March',
  frequency: 'monthly',
  periodStart: new Date('2026-03-01'),
  periodEnd: new Date('2026-03-31'),
  baseCurrency: 'usd',
  employeeIds: ['m1', 'm2'],
  payoutMode: 'immediate',
} as never;

function build(transaction: jest.Mock, findOne = jest.fn().mockResolvedValue(null)) {
  const runRepo = {
    findOne,
    create: jest.fn((v) => v),
    manager: {
      transaction,
      getRepository: () => ({
        findOne: jest.fn().mockResolvedValue({ id: 't', timezone: 'UTC' }),
      }),
    },
  };
  const itemRepo = { create: jest.fn((v) => ({ ...v })) };
  const audit = { logPayrollCreated: jest.fn(), logAdjustmentCalculated: jest.fn() };
  const ops = new RunWriteOps(runRepo as never, itemRepo as never, audit as never, {} as never);
  return { ops, runRepo, audit };
}

describe('RunWriteOps.createPayrollRun', () => {
  it('saves the run and its items in one transaction', async () => {
    const manager = {
      save: jest.fn(async (entity, value) => (entity === PayrollRun ? { id: 'run1', ...value } : value)),
    };
    const transaction = jest.fn(async (cb) => cb(manager));
    const { ops } = build(transaction);
    await ops.createPayrollRun(dto, 't', 'creator');
    expect(transaction).toHaveBeenCalledTimes(1);
    const itemSave = manager.save.mock.calls.find(([e]) => e === PayrollItem);
    expect(itemSave?.[1]).toHaveLength(2);
    expect(itemSave?.[1][0].payrollRunId).toBe('run1');
  });

  it('returns the existing run when a concurrent create hits the unique key', async () => {
    const existing = { id: 'winner' };
    const findOne = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    const transaction = jest.fn().mockRejectedValue({ code: '23505' });
    const { ops, audit } = build(transaction, findOne);
    const result = await ops.createPayrollRun(dto, 't', 'creator');
    expect(result).toMatchObject({ id: 'winner', alreadyExists: true });
    expect(audit.logPayrollCreated).not.toHaveBeenCalled();
  });
});
