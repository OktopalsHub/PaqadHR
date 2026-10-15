import { PayrollFrequency } from 'src/common/enums/payroll-frequency.enum';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import type { CreatePayrollRunDto } from '../dto/create-payroll-run.dto';
import type { PayrollItemRepository } from '../repositories/payroll-item.repository';
import type { PayrollRunRepository } from '../repositories/payroll-run.repository';
import type { AuditService } from './audit.service';
import { RunLifecycle } from './run-lifecycle';

describe('RunLifecycle', () => {
  // createPayrollRun reads the tenant through payrollRunRepository.manager to resolve
  // "today" in the tenant's timezone.
  const tenantRepository = {
    findOne: jest.fn().mockResolvedValue({ id: 'tenant-1', timezone: 'Africa/Lagos' }),
  };

  const createService = () => {
    const payrollRunRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((input) => input),
      save: jest.fn().mockImplementation(async (input) => ({ ...input, id: 'run-1' })),
      manager: { getRepository: jest.fn(() => tenantRepository) },
    } as unknown as PayrollRunRepository;
    const payrollItemRepository = {
      create: jest.fn((input) => input),
      save: jest.fn().mockResolvedValue(undefined),
      countByRunIds: jest.fn().mockResolvedValue([]),
    } as unknown as PayrollItemRepository;
    const auditService = {
      logPayrollCreated: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    return {
      service: new RunLifecycle(
        payrollRunRepository,
        payrollItemRepository,
        auditService,
        {} as never,
      ),
      payrollRunRepository,
      payrollItemRepository,
    };
  };

  const baseDto = (): CreatePayrollRunDto => ({
    title: 'September payroll',
    frequency: PayrollFrequency.MONTHLY,
    periodStart: new Date('2026-09-01T00:00:00.000Z'),
    periodEnd: new Date('2026-09-30T00:00:00.000Z'),
    paymentDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    payoutMode: 'scheduled',
    baseCurrency: 'NGN',
    employeeIds: ['member-1'],
  });

  it('resolves immediate payroll to today when no payment date is supplied', async () => {
    const { service, payrollRunRepository } = createService();
    const dto = baseDto();
    dto.payoutMode = 'immediate';
    dto.paymentDate = undefined;

    await service.createPayrollRun(dto, 'tenant-1', 'admin-1');

    expect(payrollRunRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payoutMode: 'immediate',
        paymentDate: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
      }),
    );
  });

  it('resolves immediate payroll to today when a payment date is supplied', async () => {
    const { service, payrollRunRepository } = createService();
    const dto = baseDto();
    dto.payoutMode = 'immediate';

    await service.createPayrollRun(dto, 'tenant-1', 'admin-1');

    expect(payrollRunRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payoutMode: 'immediate',
        paymentDate: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
      }),
    );
  });

  it('preserves the supplied future payment date for scheduled payroll', async () => {
    const { service, payrollRunRepository } = createService();
    const dto = baseDto();

    await service.createPayrollRun(dto, 'tenant-1', 'admin-1');

    expect(payrollRunRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ payoutMode: 'scheduled', paymentDate: dto.paymentDate }),
    );
  });

  it('persists the selected payout timing and creates the payroll roster in one batch', async () => {
    const payrollRunRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((input) => input),
      save: jest.fn().mockImplementation(async (input) => ({ ...input, id: 'run-1' })),
      manager: { getRepository: jest.fn(() => tenantRepository) },
    } as unknown as PayrollRunRepository;
    const payrollItemRepository = {
      create: jest.fn((input) => input),
      save: jest.fn().mockResolvedValue(undefined),
      countByRunIds: jest.fn().mockResolvedValue([]),
    } as unknown as PayrollItemRepository;
    const auditService = {
      logPayrollCreated: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const service = new RunLifecycle(
      payrollRunRepository,
      payrollItemRepository,
      auditService,
      {} as never,
    );
    const dto = {
      title: 'September payroll',
      frequency: PayrollFrequency.MONTHLY,
      periodStart: new Date('2026-09-01T00:00:00.000Z'),
      periodEnd: new Date('2026-09-30T00:00:00.000Z'),
      paymentDate: new Date('2026-10-05T00:00:00.000Z'),
      payoutMode: 'scheduled',
      baseCurrency: 'NGN',
      employeeIds: ['member-1', 'member-2'],
    } as CreatePayrollRunDto;

    await service.createPayrollRun(dto, 'tenant-1', 'admin-1');

    expect(payrollRunRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ payoutMode: 'scheduled' }),
    );
    expect(payrollItemRepository.save).toHaveBeenCalledTimes(1);
    expect(payrollItemRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        memberId: 'member-1',
        payrollRunId: 'run-1',
        status: PayrollItemStatus.PENDING,
      }),
      expect.objectContaining({
        memberId: 'member-2',
        payrollRunId: 'run-1',
        status: PayrollItemStatus.PENDING,
      }),
    ]);
  });

  // Regression: the run list drives the "Pay employees" button. Without item counts the
  // list could not tell a paid run from an unpaid one, so it kept offering a payout with
  // nothing left to send.
  // A manager's list spans whole runs that include employees outside their reports, so
  // per-status counts would disclose other employees' pay state.
  // Regression: the list queries do not load the items relation. Treating an unloaded
  // relation as "no items" stamped APPROVED on runs whose employees had all been paid.
  it('heals a legacy run from item counts, not the unloaded items relation', async () => {
    const legacyRun = {
      id: 'run-1',
      status: PayrollStatus.PROCESSING,
      metadata: { approvedAt: '2026-01-01T00:00:00.000Z' },
    };
    const payrollRunRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => input),
      paginate: jest.fn().mockResolvedValue({ data: [legacyRun], total: 1 }),
    } as unknown as PayrollRunRepository;
    const payrollItemRepository = {
      create: jest.fn((input) => input),
      save: jest.fn().mockResolvedValue(undefined),
      countByRunIds: jest
        .fn()
        .mockResolvedValue([{ payrollRunId: 'run-1', status: PayrollItemStatus.PAID, count: 4 }]),
    } as unknown as PayrollItemRepository;

    const service = new RunLifecycle(
      payrollRunRepository,
      payrollItemRepository,
      { logPayrollCreated: jest.fn() } as unknown as AuditService,
      {} as never,
    );

    const result = await service.getPayrollRuns('tenant-1');

    expect(result.runs[0].status).toBe(PayrollStatus.COMPLETED);
    expect(payrollRunRepository.save).toHaveBeenCalled();
  });

  it('still stamps APPROVED when the run genuinely has no items', async () => {
    const legacyRun = {
      id: 'run-1',
      status: PayrollStatus.PROCESSING,
      metadata: { approvedAt: '2026-01-01T00:00:00.000Z' },
    };
    const payrollRunRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => input),
      paginate: jest.fn().mockResolvedValue({ data: [legacyRun], total: 1 }),
    } as unknown as PayrollRunRepository;
    const payrollItemRepository = {
      create: jest.fn((input) => input),
      save: jest.fn().mockResolvedValue(undefined),
      countByRunIds: jest.fn().mockResolvedValue([]),
    } as unknown as PayrollItemRepository;

    const service = new RunLifecycle(
      payrollRunRepository,
      payrollItemRepository,
      { logPayrollCreated: jest.fn() } as unknown as AuditService,
      {} as never,
    );

    const result = await service.getPayrollRuns('tenant-1');

    expect(result.runs[0].status).toBe(PayrollStatus.APPROVED);
  });

  it('omits item counts for non-admin requesters', async () => {
    const payrollRunRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((input) => input),
      save: jest.fn(),
      paginate: jest.fn().mockResolvedValue({
        data: [{ id: 'run-1', status: PayrollStatus.APPROVED, metadata: { approvedAt: 'x' } }],
        total: 1,
      }),
    } as unknown as PayrollRunRepository;
    const payrollItemRepository = {
      create: jest.fn((input) => input),
      save: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([{ payrollRunId: 'run-1' }]),
      countByRunIds: jest
        .fn()
        .mockResolvedValue([{ payrollRunId: 'run-1', status: PayrollItemStatus.PAID, count: 5 }]),
    } as unknown as PayrollItemRepository;
    const managerAccessService = {
      getDirectReportIds: jest.fn().mockResolvedValue(['member-9']),
    };
    const service = new RunLifecycle(
      payrollRunRepository,
      payrollItemRepository,
      { logPayrollCreated: jest.fn() } as unknown as AuditService,
      managerAccessService as never,
    );

    const result = await service.getPayrollRunsForRequester(
      'tenant-1',
      20,
      0,
      'manager-1',
      'member',
    );

    // Counts are fetched to heal legacy runs, but must never reach a manager's response.
    expect(result.runs[0]).not.toHaveProperty('itemCounts');
    expect(JSON.stringify(result)).not.toContain('itemCounts');
  });

  it('reports per-status item counts so the list can hide payout on settled runs', async () => {
    const payrollRunRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((input) => input),
      save: jest.fn(),
      paginate: jest.fn().mockResolvedValue({
        data: [{ id: 'run-1', status: PayrollStatus.APPROVED, metadata: { approvedAt: 'x' } }],
        total: 1,
      }),
    } as unknown as PayrollRunRepository;
    const payrollItemRepository = {
      create: jest.fn((input) => input),
      save: jest.fn().mockResolvedValue(undefined),
      countByRunIds: jest
        .fn()
        .mockResolvedValue([{ payrollRunId: 'run-1', status: PayrollItemStatus.PAID, count: 3 }]),
    } as unknown as PayrollItemRepository;
    const service = new RunLifecycle(
      payrollRunRepository,
      payrollItemRepository,
      { logPayrollCreated: jest.fn() } as unknown as AuditService,
      {} as never,
    );

    const result = await service.getPayrollRuns('tenant-1');

    expect(payrollItemRepository.countByRunIds).toHaveBeenCalledWith(['run-1'], 'tenant-1');
    expect(result.runs[0]).toEqual(expect.objectContaining({ itemCounts: { paid: 3 } }));
  });
});
