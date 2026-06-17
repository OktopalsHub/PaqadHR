import { BadRequestException } from '@nestjs/common';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import type { NombaProvider } from 'src/common/providers/nomba.provider';
import type { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import type { PayrollItem } from '../entities/payroll-item.entity';
import type { PayrollRun } from '../entities/payroll-run.entity';
import type { PayrollItemRepository } from '../repositories/payroll-item.repository';
import type { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { MultiPaymentService } from './multi-payment.service';
import type { PayrollPayoutService } from './payroll-payout.service';

describe('MultiPaymentService', () => {
  const originalNombaClientId = process.env.NOMBA_CLIENT_ID;
  const originalNombaClientSecret = process.env.NOMBA_CLIENT_SECRET;
  const originalNombaAccountId = process.env.NOMBA_ACCOUNT_ID;

  const createService = () => {
    const payrollRunRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as unknown as PayrollRunRepository;

    const payrollItemRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findByPayrollRunId: jest.fn(),
    } as unknown as PayrollItemRepository;

    const paymentMethodService = {
      assessPayrollReadiness: jest.fn(),
      findById: jest.fn(),
      recordPaymentMethodUsage: jest.fn(),
    } as unknown as PaymentMethodService;

    const nombaProvider = {
      createPayment: jest.fn(),
    } as unknown as NombaProvider;

    const payrollPayoutService = {
      classifyPaymentResultStatus: jest.fn(),
      reconcilePayrollRunStatus: jest.fn(),
    } as unknown as PayrollPayoutService;

    const service = new MultiPaymentService(
      payrollRunRepository,
      payrollItemRepository,
      paymentMethodService,
      {} as never,
      nombaProvider,
      payrollPayoutService,
    );

    return {
      service,
      payrollRunRepository,
      payrollItemRepository,
      paymentMethodService,
      nombaProvider,
      payrollPayoutService,
    };
  };

  afterEach(() => {
    process.env.NOMBA_CLIENT_ID = originalNombaClientId;
    process.env.NOMBA_CLIENT_SECRET = originalNombaClientSecret;
    process.env.NOMBA_ACCOUNT_ID = originalNombaAccountId;
    jest.restoreAllMocks();
  });

  it('throws when Nomba gateway is not configured', async () => {
    delete process.env.NOMBA_CLIENT_ID;
    delete process.env.NOMBA_CLIENT_SECRET;
    delete process.env.NOMBA_ACCOUNT_ID;
    const { service } = createService();

    await expect(
      service.processMultiPaymentPayroll('run-1', 'tenant-1', { userId: 'u1' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('processes approved payroll and reconciles run status', async () => {
    process.env.NOMBA_CLIENT_ID = 'id';
    process.env.NOMBA_CLIENT_SECRET = 'secret';
    process.env.NOMBA_ACCOUNT_ID = 'account';

    const {
      service,
      payrollRunRepository,
      payrollItemRepository,
      paymentMethodService,
      nombaProvider,
      payrollPayoutService,
    } = createService();

    const item = {
      id: 'item-1',
      memberId: 'member-1',
      paymentCurrency: 'NGN',
      status: PayrollItemStatus.PENDING,
      employee: { firstName: 'Ada', lastName: 'Lovelace' },
      metadata: {},
    } as PayrollItem;

    const payrollRun = {
      id: 'run-1',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      baseCurrency: 'NGN',
      items: [item],
      tenant: { name: 'Acme' },
    } as PayrollRun;

    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(payrollRun);
    (paymentMethodService.assessPayrollReadiness as jest.Mock).mockResolvedValue({
      ready: true,
      paymentMethodId: 'pm-1',
    });
    (paymentMethodService.findById as jest.Mock).mockResolvedValue({
      id: 'pm-1',
      accountNumber: '1234567890',
      accountName: 'Ada',
      bankCode: '058',
      bankName: 'GTBank',
      currency: 'NGN',
      country: 'NG',
    });
    (nombaProvider.createPayment as jest.Mock).mockResolvedValue({
      success: true,
      transactionId: 'txn-1',
      providerStatus: 'PROCESSING',
    });
    (payrollPayoutService.classifyPaymentResultStatus as jest.Mock).mockReturnValue('processing');

    const result = await service.processMultiPaymentPayroll('run-1', 'tenant-1', {
      userId: 'u1',
    } as never);

    expect(result.totalItems).toBe(1);
    expect(payrollPayoutService.reconcilePayrollRunStatus).toHaveBeenCalledWith('run-1');
    expect(payrollItemRepository.update).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({ status: PayrollItemStatus.PROCESSING }),
    );
  });
});
