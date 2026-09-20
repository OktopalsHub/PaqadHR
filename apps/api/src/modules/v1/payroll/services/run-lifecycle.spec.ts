import { PayrollFrequency } from 'src/common/enums/payroll-frequency.enum';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import type { CreatePayrollRunDto } from '../dto/create-payroll-run.dto';
import type { PayrollItemRepository } from '../repositories/payroll-item.repository';
import type { PayrollRunRepository } from '../repositories/payroll-run.repository';
import type { AuditService } from './audit.service';
import { RunLifecycle } from './run-lifecycle';

describe('RunLifecycle', () => {

  const createService = () => {
    const payrollRunRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((input) => input),
      save: jest.fn().mockImplementation(async (input) => ({ ...input, id: 'run-1' })),
    } as unknown as PayrollRunRepository;
    const payrollItemRepository = {
      create: jest.fn((input) => input),
      save: jest.fn().mockResolvedValue(undefined),
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
    } as unknown as PayrollRunRepository;
    const payrollItemRepository = {
      create: jest.fn((input) => input),
      save: jest.fn().mockResolvedValue(undefined),
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
});
