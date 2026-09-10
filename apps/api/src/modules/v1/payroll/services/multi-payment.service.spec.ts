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
      createQueryBuilder: jest.fn(),
    } as unknown as PayrollItemRepository;

    const paymentMethodService = {
      assessPayrollReadiness: jest.fn(),
      findById: jest.fn(),
      recordPaymentMethodUsage: jest.fn(),
    } as unknown as PaymentMethodService;

    const paymentProvider = {
      createPayment: jest.fn(),
      createBulkTransfer: jest.fn(),
    };
    (paymentProvider.createBulkTransfer as jest.Mock).mockImplementation(
      async (transfers: Array<{ merchantTxRef?: string }>) => {
        const results: Array<Record<string, unknown>> = [];
        for (const transfer of transfers) {
          const result = (await paymentProvider.createPayment(transfer)) as Record<string, unknown>;
          results.push({
            ...result,
            reference: result.reference ?? transfer.merchantTxRef,
          });
        }
        return results;
      },
    );

    const paymentProviderFactory = {
      resolveProvider: jest.fn().mockReturnValue(paymentProvider),
      getFiatProvider: jest.fn().mockReturnValue(paymentProvider),
    } as unknown as PaymentProviderFactoryService;

    const payrollPayoutService = {
      classifyPaymentResultStatus: jest.fn(),
      reconcilePayrollRunStatus: jest.fn(),
      reconcileFailedItemBeforeRetry: jest.fn().mockResolvedValue(true),
    } as unknown as PayrollPayoutService;

    const claimIds: string[] = [];
    (payrollItemRepository.createQueryBuilder as jest.Mock).mockImplementation(() => {
      const qb: Record<string, jest.Mock> = {};
      qb.update = jest.fn().mockReturnValue(qb);
      qb.set = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn((_clause: string, params?: { ids?: string[] }) => {
        if (params?.ids) {
          claimIds.length = 0;
          claimIds.push(...params.ids);
        }
        return qb;
      });
      qb.andWhere = jest.fn().mockReturnValue(qb);
      qb.returning = jest.fn().mockReturnValue(qb);
      qb.execute = jest.fn(async () => ({
        raw: claimIds.map((id) => ({ id })),
      }));
      return qb;
    });

    const service = new MultiPaymentService(
      payrollRunRepository,
      payrollItemRepository,
      paymentMethodService,
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

  it('throws when no pending employees are payable', async () => {
    process.env.NOMBA_CLIENT_ID = 'id';
    process.env.NOMBA_CLIENT_SECRET = 'secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account';

    const { service, payrollRunRepository, paymentMethodService, payrollPayoutService } =
      createService();

    const item = {
      id: 'item-1',
      memberId: 'member-1',
      paymentCurrency: 'NGN',
      paymentAmount: 1000,
      status: PayrollItemStatus.PENDING,
      employee: { firstName: 'Ada', lastName: 'Lovelace' },
      metadata: {},
    } as PayrollItem;

    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'run-1',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      baseCurrency: 'NGN',
      items: [item],
      tenant: { name: 'Acme' },
    });
    (paymentMethodService.assessPayrollReadiness as jest.Mock).mockResolvedValue({
      ready: false,
      message: 'No verified bank account',
    });

    await expect(
      service.processMultiPaymentPayroll('run-1', 'tenant-1', { userId: 'u1' } as never),
    ).rejects.toThrow(/No employees could be paid/);
    expect(payrollPayoutService.reconcilePayrollRunStatus).toHaveBeenCalledWith(
      'run-1',
      'tenant-1',
    );
  });

  it('throws when no payroll gateway is configured', async () => {
    delete process.env.NOMBA_CLIENT_ID;
    delete process.env.NOMBA_CLIENT_SECRET;
    delete process.env.NOMBA_PARENT_ACCOUNT_ID;
    delete process.env.NOAH_API_KEY;
    delete process.env.MONNIFY_API_KEY;
    delete process.env.MONNIFY_SECRET_KEY;
    delete process.env.MONNIFY_CONTRACT_CODE;
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
      paymentAmount: 1000,
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
    (paymentMethodService.findById as jest.Mock).mockImplementation(
      (id: string, tenantId: string) => ({
        id: 'pm-1',
        accountNumber: '1234567890',
        accountName: 'Ada',
        bankCode: '058',
        bankName: 'GTBank',
        currency: 'NGN',
        country: 'NG',
      }),
    );
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
    expect(payrollPayoutService.reconcilePayrollRunStatus).toHaveBeenCalledWith(
      'run-1',
      'tenant-1',
    );
    expect(payrollItemRepository.update).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({ status: PayrollItemStatus.PROCESSING }),
    );
  });

  it('pays multiple pending employees via one createBulkTransfer call', async () => {
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

    const itemA = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      payrollRunId: '11111111-1111-4111-8111-111111111111',
      memberId: 'member-1',
      paymentCurrency: 'NGN',
      paymentAmount: 1000,
      status: PayrollItemStatus.PENDING,
      employee: { firstName: 'Ada', lastName: 'Lovelace' },
      metadata: {},
    } as PayrollItem;

    const itemB = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      payrollRunId: '11111111-1111-4111-8111-111111111111',
      memberId: 'member-2',
      paymentCurrency: 'NGN',
      paymentAmount: 2000,
      status: PayrollItemStatus.PENDING,
      employee: { firstName: 'Grace', lastName: 'Hopper' },
      metadata: {},
    } as PayrollItem;

    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      baseCurrency: 'NGN',
      title: 'September',
      items: [itemA, itemB],
      tenant: { name: 'Acme' },
    });
    (paymentMethodService.assessPayrollReadiness as jest.Mock).mockResolvedValue({
      ready: true,
      paymentMethodId: 'pm-1',
    });
    (paymentMethodService.findById as jest.Mock).mockResolvedValue({
      id: 'pm-1',
      accountNumber: '1234567890',
      accountName: 'Employee',
      bankCode: '058',
      bankName: 'GTBank',
      currency: 'NGN',
      country: 'NG',
    });
    (paymentProvider.createBulkTransfer as jest.Mock).mockImplementation(
      async (transfers: Array<{ merchantTxRef?: string }>) =>
        transfers.map((transfer, index) => ({
          success: index === 0,
          transactionId: `txn-${index}`,
          reference: transfer.merchantTxRef,
          providerStatus: index === 0 ? 'SUCCESS' : undefined,
          error: index === 0 ? undefined : 'insufficient funds',
          retryable: false,
        })),
    );
    (payrollPayoutService.classifyPaymentResultStatus as jest.Mock).mockReturnValue('paid');

    const result = await service.processMultiPaymentPayroll(
      '11111111-1111-4111-8111-111111111111',
      'tenant-1',
      { userId: 'u1' } as never,
    );

    expect(paymentProvider.createBulkTransfer).toHaveBeenCalledTimes(1);
    expect(paymentProvider.createBulkTransfer.mock.calls[0][0]).toHaveLength(2);
    expect(paymentProvider.createPayment).not.toHaveBeenCalled();
    expect(result.totalItems).toBe(2);
    expect(payrollItemRepository.update).toHaveBeenCalledWith(
      itemA.id,
      expect.objectContaining({ status: PayrollItemStatus.PAID }),
    );
    expect(payrollItemRepository.update).toHaveBeenCalledWith(
      itemB.id,
      expect.objectContaining({ status: PayrollItemStatus.FAILED }),
    );
  });

  it('maps reordered bulk results by merchantTxRef and fails missing refs', async () => {
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

    const itemA = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      payrollRunId: '11111111-1111-4111-8111-111111111111',
      memberId: 'member-1',
      paymentCurrency: 'NGN',
      paymentAmount: 1000,
      status: PayrollItemStatus.PENDING,
      employee: { firstName: 'Ada', lastName: 'Lovelace' },
      metadata: {},
    } as PayrollItem;

    const itemB = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      payrollRunId: '11111111-1111-4111-8111-111111111111',
      memberId: 'member-2',
      paymentCurrency: 'NGN',
      paymentAmount: 2000,
      status: PayrollItemStatus.PENDING,
      employee: { firstName: 'Grace', lastName: 'Hopper' },
      metadata: {},
    } as PayrollItem;

    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      baseCurrency: 'NGN',
      title: 'September',
      items: [itemA, itemB],
      tenant: { name: 'Acme' },
    });
    (paymentMethodService.assessPayrollReadiness as jest.Mock).mockResolvedValue({
      ready: true,
      paymentMethodId: 'pm-1',
    });
    (paymentMethodService.findById as jest.Mock).mockResolvedValue({
      id: 'pm-1',
      accountNumber: '1234567890',
      accountName: 'Employee',
      bankCode: '058',
      bankName: 'GTBank',
      currency: 'NGN',
      country: 'NG',
    });
    (paymentProvider.createBulkTransfer as jest.Mock).mockImplementation(
      async (transfers: Array<{ merchantTxRef?: string }>) => {
        const second = transfers[1];
        return [
          {
            success: true,
            transactionId: 'txn-b',
            reference: second.merchantTxRef,
            providerStatus: 'SUCCESS',
          },
          {
            success: true,
            transactionId: 'orphan',
            reference: undefined,
            providerStatus: 'SUCCESS',
          },
        ];
      },
    );
    (payrollPayoutService.classifyPaymentResultStatus as jest.Mock).mockReturnValue('paid');

    await service.processMultiPaymentPayroll('11111111-1111-4111-8111-111111111111', 'tenant-1', {
      userId: 'u1',
    } as never);

    expect(payrollItemRepository.update).toHaveBeenCalledWith(
      itemA.id,
      expect.objectContaining({
        status: PayrollItemStatus.FAILED,
        failureReason: expect.stringContaining('Missing bulk transfer result'),
      }),
    );
    expect(payrollItemRepository.update).toHaveBeenCalledWith(
      itemB.id,
      expect.objectContaining({ status: PayrollItemStatus.PAID }),
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
      paymentAmount: 1000,
      status: PayrollItemStatus.PENDING,
      employee: { firstName: 'Ada', lastName: 'Lovelace' },
      metadata: {},
    } as PayrollItem;

    const paidItem = {
      id: 'item-paid',
      memberId: 'member-2',
      paymentCurrency: 'NGN',
      paymentAmount: 1000,
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
    (paymentMethodService.findById as jest.Mock).mockImplementation(
      (id: string, tenantId: string) => ({
        id: 'pm-1',
        accountNumber: '1234567890',
        accountName: 'Ada',
        bankCode: '058',
        bankName: 'GTBank',
        currency: 'NGN',
        country: 'NG',
      }),
    );
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
      paymentAmount: 1000,
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
    (paymentMethodService.findById as jest.Mock).mockImplementation(
      (id: string, tenantId: string) => ({
        id: 'pm-1',
        accountNumber: '1234567890',
        accountName: 'Ada',
        bankCode: '058',
        bankName: 'GTBank',
        currency: 'NGN',
        country: 'NG',
      }),
    );
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

  it('returns 404 for payment status summary when run is outside tenant', async () => {
    process.env.NOMBA_CLIENT_ID = 'id';
    process.env.NOMBA_CLIENT_SECRET = 'secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account';
    const { service, payrollRunRepository } = createService();
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.getPaymentStatusSummary('run-1', 'tenant-other')).rejects.toThrow(
      'Payroll run not found',
    );
  });

  it('rejects amounts over MAX_PAYMENT_LIMIT', async () => {
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

    const item = {
      id: 'item-huge',
      memberId: 'member-1',
      paymentCurrency: 'NGN',
      paymentAmount: 500_000,
      status: PayrollItemStatus.PENDING,
      employee: { firstName: 'Ada', lastName: 'Lovelace' },
      metadata: {},
    } as PayrollItem;

    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'run-1',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      baseCurrency: 'NGN',
      items: [item],
      tenant: { name: 'Acme' },
    });
    (paymentMethodService.assessPayrollReadiness as jest.Mock).mockResolvedValue({
      ready: true,
      paymentMethodId: 'pm-1',
    });
    (paymentMethodService.findById as jest.Mock).mockImplementation(
      (id: string, tenantId: string) => ({
        id: 'pm-1',
        accountNumber: '1234567890',
        accountName: 'Ada',
        bankCode: '058',
        currency: 'NGN',
      }),
    );

    await service.processMultiPaymentPayroll('run-1', 'tenant-1', { userId: 'u1' } as never);

    expect(paymentProvider.createPayment).not.toHaveBeenCalled();
    expect(payrollItemRepository.update).toHaveBeenCalledWith(
      'item-huge',
      expect.objectContaining({
        status: PayrollItemStatus.FAILED,
        failureReason: expect.stringContaining('maximum limit'),
      }),
    );
  });

  it('does not initiate payout when claim loses the race', async () => {
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

    const item = {
      id: 'item-race',
      memberId: 'member-1',
      paymentCurrency: 'NGN',
      paymentAmount: 1000,
      status: PayrollItemStatus.PENDING,
      employee: { firstName: 'Ada', lastName: 'Lovelace' },
      metadata: {},
    } as PayrollItem;

    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'run-1',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      baseCurrency: 'NGN',
      items: [item],
      tenant: { name: 'Acme' },
    });
    (paymentMethodService.assessPayrollReadiness as jest.Mock).mockResolvedValue({
      ready: true,
      paymentMethodId: 'pm-1',
    });
    // Concurrent worker already claimed: claim UPDATE returns no rows.
    (payrollItemRepository.createQueryBuilder as jest.Mock).mockImplementation(() => {
      const qb: Record<string, jest.Mock> = {};
      qb.update = jest.fn().mockReturnValue(qb);
      qb.set = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn().mockReturnValue(qb);
      qb.andWhere = jest.fn().mockReturnValue(qb);
      qb.returning = jest.fn().mockReturnValue(qb);
      qb.execute = jest.fn(async () => ({ raw: [] }));
      return qb;
    });

    const result = await service.processMultiPaymentPayroll('run-1', 'tenant-1', {
      userId: 'u1',
    } as never);

    expect(paymentProvider.createPayment).not.toHaveBeenCalled();
    expect(paymentProvider.createBulkTransfer).not.toHaveBeenCalled();
    expect(result.failedPayments).toBe(1);
  });

  it('uses retry suffix merchant ref on failed-item retry', async () => {
    process.env.NOMBA_CLIENT_ID = 'id';
    process.env.NOMBA_CLIENT_SECRET = 'secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account';
    const { service, payrollRunRepository, paymentMethodService, paymentProvider } =
      createService();

    const failedItem = {
      id: '22222222-2222-4222-8222-222222222222',
      payrollRunId: '11111111-1111-4111-8111-111111111111',
      memberId: 'member-1',
      paymentCurrency: 'NGN',
      paymentAmount: 1000,
      status: PayrollItemStatus.FAILED,
      employee: { firstName: 'Ada', lastName: 'Lovelace' },
      metadata: {},
    } as PayrollItem;

    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue({
      id: failedItem.payrollRunId,
      tenantId: 'tenant-1',
      status: PayrollStatus.PROCESSING,
      baseCurrency: 'NGN',
      items: [failedItem],
      tenant: { name: 'Acme' },
    });
    (paymentMethodService.assessPayrollReadiness as jest.Mock).mockResolvedValue({
      ready: true,
      paymentMethodId: 'pm-1',
    });
    (paymentMethodService.findById as jest.Mock).mockImplementation(
      (id: string, tenantId: string) => ({
        id: 'pm-1',
        accountNumber: '1234567890',
        accountName: 'Ada',
        bankCode: '058',
        bankName: 'GTBank',
        currency: 'NGN',
        country: 'NG',
      }),
    );
    (paymentProvider.createPayment as jest.Mock).mockResolvedValue({
      success: true,
      transactionId: 'txn-retry',
      providerStatus: 'PROCESSING',
    });

    await service.retryFailedPayments(failedItem.payrollRunId!, 'tenant-1', {
      userId: 'u1',
    } as never);

    expect(paymentProvider.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantTxRef: `payroll_${failedItem.payrollRunId}_${failedItem.id}_r1`,
      }),
    );
  });
});
