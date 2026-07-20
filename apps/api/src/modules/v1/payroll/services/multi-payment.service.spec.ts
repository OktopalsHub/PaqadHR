import { BadRequestException } from '@nestjs/common';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import type { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
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
  const originalNombaAccountId = process.env.NOMBA_PARENT_ACCOUNT_ID;
  const originalNoahApiKey = process.env.NOAH_API_KEY;

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

    const paymentProvider = {
      createPayment: jest.fn(),
    };

    const paymentProviderFactory = {
      resolveProvider: jest.fn().mockReturnValue(paymentProvider),
      getFiatProvider: jest.fn().mockReturnValue(paymentProvider),
    } as unknown as PaymentProviderFactoryService;

    const payrollPayoutService = {
      classifyPaymentResultStatus: jest.fn(),
      reconcilePayrollRunStatus: jest.fn(),
    } as unknown as PayrollPayoutService;

    const service = new MultiPaymentService(
      payrollRunRepository,
      payrollItemRepository,
      paymentMethodService,
      {} as never,
      paymentProviderFactory,
      payrollPayoutService,
    );

    return {
      service,
      payrollRunRepository,
      payrollItemRepository,
      paymentMethodService,
      paymentProvider,
      paymentProviderFactory,
      payrollPayoutService,
    };
  };

  afterEach(() => {
    process.env.NOMBA_CLIENT_ID = originalNombaClientId;
    process.env.NOMBA_CLIENT_SECRET = originalNombaClientSecret;
    process.env.NOMBA_PARENT_ACCOUNT_ID = originalNombaAccountId;
    process.env.NOAH_API_KEY = originalNoahApiKey;
    jest.restoreAllMocks();
  });

  it('throws when no payroll gateway is configured', async () => {
    delete process.env.NOMBA_CLIENT_ID;
    delete process.env.NOMBA_CLIENT_SECRET;
    delete process.env.NOMBA_PARENT_ACCOUNT_ID;
    delete process.env.NOAH_API_KEY;
    const { service } = createService();

    await expect(
      service.processMultiPaymentPayroll('run-1', 'tenant-1', { userId: 'u1' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('processes approved payroll and reconciles run status', async () => {
    process.env.NOMBA_CLIENT_ID = 'id';
    process.env.NOMBA_CLIENT_SECRET = 'secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account';

    const {
      service,
      payrollRunRepository,
      payrollItemRepository,
      paymentMethodService,
      paymentProvider,
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
    (paymentProvider.createPayment as jest.Mock).mockResolvedValue({
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

  it('skips already paid items when re-processing a payroll run', async () => {
    process.env.NOMBA_CLIENT_ID = 'id';
    process.env.NOMBA_CLIENT_SECRET = 'secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account';

    const {
      service,
      payrollRunRepository,
      payrollItemRepository,
      paymentMethodService,
      paymentProvider,
    } = createService();

    const pendingItem = {
      id: 'item-pending',
      memberId: 'member-1',
      paymentCurrency: 'NGN',
      status: PayrollItemStatus.PENDING,
      employee: { firstName: 'Ada', lastName: 'Lovelace' },
      metadata: {},
    } as PayrollItem;

    const paidItem = {
      id: 'item-paid',
      memberId: 'member-2',
      paymentCurrency: 'NGN',
      status: PayrollItemStatus.PAID,
      employee: { firstName: 'Grace', lastName: 'Hopper' },
      metadata: {},
    } as PayrollItem;

    const payrollRun = {
      id: 'run-1',
      tenantId: 'tenant-1',
      status: PayrollStatus.PROCESSING,
      baseCurrency: 'NGN',
      items: [pendingItem, paidItem],
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
    (paymentProvider.createPayment as jest.Mock).mockResolvedValue({
      success: true,
      transactionId: 'txn-2',
      providerStatus: 'PROCESSING',
    });

    const result = await service.processMultiPaymentPayroll('run-1', 'tenant-1', {
      userId: 'u1',
    } as never);

    expect(result.totalItems).toBe(2);
    expect(paymentProvider.createPayment).toHaveBeenCalledTimes(1);
    expect(payrollItemRepository.update).toHaveBeenCalledWith(
      'item-pending',
      expect.objectContaining({ status: PayrollItemStatus.PROCESSING }),
    );
    expect(payrollItemRepository.update).not.toHaveBeenCalledWith('item-paid', expect.anything());
  });

  it('retries failed items after resetting in-memory status', async () => {
    process.env.NOMBA_CLIENT_ID = 'id';
    process.env.NOMBA_CLIENT_SECRET = 'secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account';

    const {
      service,
      payrollRunRepository,
      paymentMethodService,
      paymentProvider,
      payrollPayoutService,
    } = createService();

    const failedItem = {
      id: 'item-failed',
      memberId: 'member-1',
      paymentCurrency: 'NGN',
      status: PayrollItemStatus.FAILED,
      employee: { firstName: 'Ada', lastName: 'Lovelace' },
      metadata: {},
    } as PayrollItem;

    const payrollRun = {
      id: 'run-1',
      tenantId: 'tenant-1',
      status: PayrollStatus.PROCESSING,
      baseCurrency: 'NGN',
      items: [failedItem],
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
    (paymentProvider.createPayment as jest.Mock).mockResolvedValue({
      success: true,
      transactionId: 'txn-retry',
      providerStatus: 'PROCESSING',
    });
    (payrollPayoutService.classifyPaymentResultStatus as jest.Mock).mockReturnValue('processing');

    await service.retryFailedPayments('run-1', 'tenant-1', { userId: 'u1' } as never);

    expect(failedItem.status).toBe(PayrollItemStatus.PENDING);
    expect(paymentProvider.createPayment).toHaveBeenCalledTimes(1);
  });
});
