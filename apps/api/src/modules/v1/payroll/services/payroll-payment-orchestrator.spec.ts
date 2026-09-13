import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import type { PayrollItem } from '../entities/payroll-item.entity';
import type { PayrollRun } from '../entities/payroll-run.entity';
import type { PayrollItemRepository } from '../repositories/payroll-item.repository';
import type { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { PayrollPaymentOrchestrator } from './payroll-payment-orchestrator';

describe('PayrollPaymentOrchestrator', () => {
  const createService = () => {
    const payrollRunRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as PayrollRunRepository;
    const payrollItemRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as PayrollItemRepository;
    const paymentMethodService = {
      assessPayrollReadiness: jest.fn().mockResolvedValue({ ready: true }),
    };
    const auditService = {
      logPayrollApproved: jest.fn().mockResolvedValue(undefined),
    };
    const lifecycleNotify = {
      onPayrollApproved: jest.fn().mockResolvedValue(undefined),
      onPayrollScheduled: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PayrollPaymentOrchestrator(
      payrollRunRepository,
      payrollItemRepository,
      paymentMethodService as never,
      {} as never,
      auditService as never,
      {} as never,
      {} as never,
      {} as never,
      lifecycleNotify as never,
    );

    return { service, payrollRunRepository, payrollItemRepository, auditService, lifecycleNotify };
  };

  it('audits and notifies when an approved payroll was scheduled at creation', async () => {
    const { service, payrollRunRepository, payrollItemRepository, lifecycleNotify } =
      createService();
    const item = {
      id: 'item-1',
      memberId: 'member-1',
      status: PayrollItemStatus.PENDING,
      metadata: {},
    } as PayrollItem;
    const run = {
      id: 'run-1',
      tenantId: 'tenant-1',
      title: 'September payroll',
      status: PayrollStatus.PROCESSING,
      payoutMode: 'scheduled',
      paymentDate: new Date('2026-10-05T00:00:00.000Z'),
      periodStart: new Date('2026-09-01T00:00:00.000Z'),
      periodEnd: new Date('2026-09-30T00:00:00.000Z'),
      baseCurrency: 'NGN',
      employeeCount: 1,
      totalNetAmount: 150000,
      items: [item],
      metadata: {},
    } as PayrollRun;
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(run);

    await service.approvePayroll('run-1', 'tenant-1', {
      tenantId: 'tenant-1',
      payrollRunId: 'run-1',
      performedById: 'admin-1',
    });

    expect(run.status).toBe(PayrollStatus.APPROVED);
    expect(run.metadata).toEqual(
      expect.objectContaining({ approvedBy: 'admin-1', scheduledFor: '2026-10-05' }),
    );
    expect(payrollItemRepository.save).toHaveBeenCalledWith(item);
    expect(lifecycleNotify.onPayrollScheduled).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentDate: '2026-10-05',
        run: expect.objectContaining({ id: 'run-1' }),
      }),
    );
  });
});
