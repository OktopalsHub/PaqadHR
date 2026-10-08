import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollItemRepository } from './payroll-item.repository';

/**
 * payroll_items has no soft-delete column: the entity has no @DeleteDateColumn and the
 * only migration touching the table does not create `deleted_at`. A `deletedAt IS NULL`
 * filter therefore fails at plan time with 'column "deleted_at" does not exist' and takes
 * the whole payroll list endpoint down. Cancelled employees are status CANCELLED instead.
 */
describe('PayrollItemRepository payroll_items soft-delete assumptions', () => {
  const buildRepo = () => {
    const qb: Record<string, unknown> = {};
    const chain = [
      'select',
      'addSelect',
      'innerJoin',
      'leftJoinAndSelect',
      'where',
      'andWhere',
      'groupBy',
    ];
    for (const method of chain) qb[method] = jest.fn().mockReturnValue(qb);
    qb.addGroupBy = jest.fn().mockReturnValue(qb);
    qb.getRawMany = jest.fn().mockResolvedValue([]);
    qb.getMany = jest.fn().mockResolvedValue([]);
    // Use the real prototype so the query methods under test actually run.
    const repo = Object.create(PayrollItemRepository.prototype) as PayrollItemRepository;
    repo.createQueryBuilder = jest.fn().mockReturnValue(qb) as never;
    return { repo, qb: qb as { andWhere: jest.Mock; where: jest.Mock } };
  };

  it('countByRunIds never filters on a deletedAt column', async () => {
    const { repo, qb } = buildRepo();

    await repo.countByRunIds(['run-1'], 'tenant-1');

    const clauses = [...qb.where.mock.calls, ...qb.andWhere.mock.calls].flat();
    expect(clauses.join(' ')).not.toMatch(/deletedAt/i);
  });

  it('findByPayrollRunId never filters on a deletedAt column', async () => {
    const { repo, qb } = buildRepo();

    await repo.findByPayrollRunId('run-1', 'tenant-1');

    const clauses = [...qb.where.mock.calls, ...qb.andWhere.mock.calls].flat();
    expect(clauses.join(' ')).not.toMatch(/deletedAt/i);
  });

  it('countByRunIds skips the query entirely for an empty page', async () => {
    const { repo } = buildRepo();

    await expect(repo.countByRunIds([], 'tenant-1')).resolves.toEqual([]);
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('countByRunIds returns one row per run and status, parsing counts as integers', async () => {
    const { repo, qb } = buildRepo();
    (qb as unknown as { getRawMany: jest.Mock }).getRawMany = jest.fn().mockResolvedValue([
      { payrollRunId: 'run-1', status: PayrollItemStatus.PAID, count: '3' },
      { payrollRunId: 'run-2', status: PayrollItemStatus.PROCESSING, count: '2' },
    ]);

    await expect(repo.countByRunIds(['run-1', 'run-2'], 'tenant-1')).resolves.toEqual([
      { payrollRunId: 'run-1', status: PayrollItemStatus.PAID, count: 3 },
      { payrollRunId: 'run-2', status: PayrollItemStatus.PROCESSING, count: 2 },
    ]);
  });

  it('countByRunIds scopes to the tenant through the run join', async () => {
    const { repo, qb } = buildRepo();

    await repo.countByRunIds(['run-1'], 'tenant-1');

    const join = (qb as unknown as { innerJoin: jest.Mock }).innerJoin.mock.calls[0];
    expect(join[2]).toContain('tenantId');
  });
});
