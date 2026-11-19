import { PayrollFundingAttempt } from '../entities/payroll-funding-attempt.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollAttemptHistoryService } from './payroll-attempt-history.service';

describe('PayrollAttemptHistoryService funding attempts', () => {
  const input = {
    tenantId: 'tenant-1',
    payrollRunId: 'run-1',
    purpose: 'retry_shortfall' as const,
    provider: 'BACHS',
    orderReference: 'pf_ref_1',
    idempotencyKey: 'payroll-funding:tenant-1:run-1:retry_shortfall:pf_ref_1',
    currency: 'USD',
    amount: '25',
    checkoutAmount: '10',
    balanceApplied: '15',
    selectedItemIds: ['item-1'],
  };

  const build = (existing: unknown = null, previous: unknown = null) => {
    const attempts = {
      findOne: jest.fn().mockResolvedValueOnce(existing).mockResolvedValueOnce(previous),
      create: jest.fn((value: object) => value),
      save: jest.fn(async (value: object) => value),
    };
    const runQuery = {
      setLock: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 'run-1', tenantId: 'tenant-1' }),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === PayrollRun ? { createQueryBuilder: () => runQuery } : attempts,
      ),
    };
    const service = new PayrollAttemptHistoryService(
      {} as never,
      {} as never,
      { transaction: jest.fn() } as never,
    );
    return { service, attempts, manager };
  };

  it('numbers a new retry_shortfall attempt after the previous one', async () => {
    const { service, attempts, manager } = build(null, { attemptNumber: 2 });
    const attempt = await service.beginFundingAttempt(input, manager as never);
    expect(attempt).toEqual(
      expect.objectContaining({ attemptNumber: 3, status: 'pending', purpose: 'retry_shortfall' }),
    );
    expect(attempts.save).toHaveBeenCalledTimes(1);
  });

  it('returns the existing attempt on replay without writing again', async () => {
    const existing = { id: 'a1', attemptNumber: 1 };
    const { service, attempts, manager } = build(existing);
    await expect(service.beginFundingAttempt(input, manager as never)).resolves.toBe(existing);
    expect(attempts.save).not.toHaveBeenCalled();
  });

  it('rejects an attempt for a run outside the tenant', async () => {
    const { service, manager } = build();
    manager.getRepository(PayrollRun) as never as { createQueryBuilder: () => never };
    const other = {
      getRepository: (entity: unknown) =>
        entity === PayrollRun
          ? {
              createQueryBuilder: () => ({
                setLock: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(null),
              }),
            }
          : {},
    };
    await expect(service.beginFundingAttempt(input, other as never)).rejects.toThrow(
      /does not belong/,
    );
  });

  it('does not let a confirmed attempt be cancelled', async () => {
    const attempt = { status: 'confirmed', providerReference: null } as PayrollFundingAttempt;
    const save = jest.fn(async (value: PayrollFundingAttempt) => value);
    const qb = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(attempt),
    };
    const service = new PayrollAttemptHistoryService(
      {} as never,
      {} as never,
      {
        transaction: (cb: (m: unknown) => unknown) =>
          cb({ getRepository: () => ({ createQueryBuilder: () => qb, save }) }),
      } as never,
    );
    const result = await service.transitionFundingAttempt({
      tenantId: 'tenant-1',
      payrollRunId: 'run-1',
      provider: 'BACHS',
      orderReference: 'pf_ref_1',
      status: 'cancelled',
    });
    expect(result?.status).toBe('confirmed');
    expect(save).not.toHaveBeenCalled();
  });
});
