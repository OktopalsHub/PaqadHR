import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import type { PayrollItem } from '../entities/payroll-item.entity';
import type { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { PayoutReconciliation } from './payout-reconciliation';
import type { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';

describe('PayoutReconciliation', () => {
  const createService = () => {
    const savedItem = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      payrollRunId: 'run-1',
      memberId: 'member-1',
      status: PayrollItemStatus.PROCESSING,
      paymentAmount: 1000,
      metadata: {},
      payrollRun: {
        id: 'run-1',
        tenantId: 'tenant-1',
        createdById: 'admin-1',
      },
    } as unknown as PayrollItem;

    const lockedItem = { ...savedItem } as PayrollItem;
    const transactionRepository = {
      findOne: jest.fn().mockResolvedValue(lockedItem),
      save: jest.fn().mockResolvedValue(lockedItem),
    };
    const payrollRunTransactionRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'run-1',
        tenantId: 'tenant-1',
      }),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity && typeof entity === 'function' && entity.name === 'PayrollRun'
          ? payrollRunTransactionRepository
          : transactionRepository,
      ),
    };
    const payrollItemRepo = {
      manager: {
        transaction: jest.fn(async (callback: (txManager: typeof manager) => Promise<boolean>) =>
          callback(manager),
        ),
      },
    } as unknown as import('typeorm').Repository<PayrollItem>;

    const payrollRunRepository = {
      findOne: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
    } as unknown as PayrollRunRepository;
    const factory = {} as never;
    const fincraApi = {} as never;
    const lifecycleNotify = {
      onItemPaid: jest.fn().mockResolvedValue(undefined),
      onItemFailed: jest.fn().mockResolvedValue(undefined),
    } as unknown as PayrollLifecycleNotifyService;

    const service = new PayoutReconciliation(
      fincraApi,
      factory,
      payrollRunRepository,
      payrollItemRepo,
      lifecycleNotify,
    );

    return { service, transactionRepository, lifecycleNotify, savedItem };
  };

  it('serializes duplicate success webhooks with a row lock', async () => {
    const { service, transactionRepository, lifecycleNotify, savedItem } = createService();

    const changed = await service.applyTransferStatus(
      'pi_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'SUCCESS',
      'txn-1',
      PaymentProvider.NOMBA,
      'tenant-1',
      1000,
    );

    expect(changed).toBe(true);
    expect(transactionRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        lock: { mode: 'pessimistic_write' },
      }),
    );
    expect(transactionRepository.save).toHaveBeenCalledTimes(1);
    expect(transactionRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: savedItem.id },
        relations: ['payrollRun', 'employee'],
      }),
    );
    expect(lifecycleNotify.onItemPaid).toHaveBeenCalledTimes(1);
  });

  it('passes the committed failed state to lifecycle notification before releasing the row lock', async () => {
    const { service, transactionRepository, lifecycleNotify } = createService();
    const failedItem = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      payrollRunId: 'run-1',
      memberId: 'member-1',
      status: PayrollItemStatus.FAILED,
      paymentAmount: 1000,
      failureReason: 'nomba failed',
      metadata: {},
      payrollRun: {
        id: 'run-1',
        tenantId: 'tenant-1',
        createdById: 'admin-1',
      },
      employee: {},
    } as unknown as PayrollItem;

    transactionRepository.findOne
      .mockResolvedValueOnce({
        id: failedItem.id,
        payrollRunId: failedItem.payrollRunId,
        memberId: failedItem.memberId,
        status: PayrollItemStatus.PROCESSING,
        paymentAmount: 1000,
        metadata: {},
      })
      .mockResolvedValueOnce(failedItem);

    const changed = await service.applyTransferStatus(
      'pi_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'FAILED',
      'txn-failed',
      PaymentProvider.NOMBA,
      'tenant-1',
    );

    expect(changed).toBe(true);
    expect(lifecycleNotify.onItemFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        item: failedItem,
        reason: 'nomba failed',
      }),
    );
  });

  const buildRequeryService = (
    stuckItems: PayrollItem[],
    overrides?: { resolveTenantId?: string | undefined; queryStatus?: jest.Mock },
  ) => {
    const savedItem = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      payrollRunId: 'run-1',
      memberId: 'member-1',
      status: PayrollItemStatus.PROCESSING,
      paymentAmount: 1000,
      metadata: {},
      payrollRun: { id: 'run-1', tenantId: 'tenant-1', createdById: 'admin-1' },
    } as unknown as PayrollItem;
    const transactionRepository = {
      findOne: jest.fn().mockResolvedValue(savedItem),
      save: jest.fn(async (entity: PayrollItem) => entity),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity && typeof entity === 'function' && entity.name === 'PayrollRun'
          ? { findOne: jest.fn().mockResolvedValue({ id: 'run-1', tenantId: 'tenant-1' }) }
          : transactionRepository,
      ),
    };
    const itemQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const payrollItemRepo = {
      find: jest.fn().mockResolvedValue(stuckItems),
      createQueryBuilder: jest.fn().mockReturnValue(itemQueryBuilder),
      update: jest.fn().mockResolvedValue(undefined),
      manager: {
        transaction: jest.fn(async (callback: (txManager: typeof manager) => Promise<boolean>) =>
          callback(manager),
        ),
      },
    } as unknown as import('typeorm').Repository<PayrollItem>;
    const payrollRunRepository = {
      findOne: jest
        .fn()
        .mockResolvedValue(
          overrides && 'resolveTenantId' in overrides
            ? overrides.resolveTenantId
              ? { tenantId: overrides.resolveTenantId }
              : null
            : { tenantId: 'tenant-1' },
        ),
      findByIdWithItems: jest.fn().mockResolvedValue({
        id: 'run-1',
        tenantId: 'tenant-1',
        items: [],
        status: 'APPROVED',
      }),
      save: jest.fn(async (run: unknown) => run),
    } as unknown as PayrollRunRepository;
    const queryStatus = overrides?.queryStatus ?? jest.fn().mockResolvedValue(null);
    const factory = {
      resolvePayoutQuerier: jest.fn(() => ({ queryStatus })),
    } as never;
    const fincraApi = {} as never;
    const lifecycleNotify = {
      onItemPaid: jest.fn().mockResolvedValue(undefined),
      onItemFailed: jest.fn().mockResolvedValue(undefined),
    } as unknown as PayrollLifecycleNotifyService;

    const service = new PayoutReconciliation(
      fincraApi,
      factory,
      payrollRunRepository,
      payrollItemRepo,
      lifecycleNotify,
    );

    return { service, payrollItemRepo, itemQueryBuilder, lifecycleNotify, queryStatus };
  };

  const stuckProcessingItem = (overrides?: Partial<PayrollItem>) =>
    ({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      payrollRunId: 'run-1',
      memberId: 'member-1',
      status: PayrollItemStatus.PROCESSING,
      paymentAmount: 1000,
      transactionId: null,
      failureReason: 'Withdrawals to this bank are currently unavailable.',
      metadata: {},
      updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      payrollRun: { id: 'run-1', tenantId: 'tenant-1', createdById: 'admin-1' },
      ...overrides,
    }) as unknown as PayrollItem;

  it('fails a stuck PROCESSING item that never created a payout, instead of skipping it forever', async () => {
    const { service, itemQueryBuilder, lifecycleNotify } = buildRequeryService([
      stuckProcessingItem(),
    ]);

    const result = await service.requeryStuckPayouts();

    expect(itemQueryBuilder.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: PayrollItemStatus.FAILED }),
    );
    expect(itemQueryBuilder.where).toHaveBeenCalledWith('id = :itemId', {
      itemId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    // The failure update must stay scoped to the owning tenant's run (BOLA).
    expect(itemQueryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('payroll_runs'),
      { tenantId: 'tenant-1' },
    );
    expect(itemQueryBuilder.execute).toHaveBeenCalledTimes(1);
    expect(lifecycleNotify.onItemFailed).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ checked: 1, updated: 1 });
  });

  it('never auto-fails an item whose payout submission outcome is unknown', async () => {
    // The provider may have accepted the payout and lost the response. Failing it would make
    // it retryable, and the retry mints a new merchant ref + idempotency key — a second payout.
    const { service, itemQueryBuilder, lifecycleNotify } = buildRequeryService([
      stuckProcessingItem({ metadata: { payoutSubmissionPending: true } }),
    ]);

    const result = await service.requeryStuckPayouts();

    expect(itemQueryBuilder.execute).not.toHaveBeenCalled();
    expect(lifecycleNotify.onItemFailed).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 1, updated: 0 });
  });

  it('refuses to retry an item whose payout submission outcome is unknown', async () => {
    const { service } = buildRequeryService([
      stuckProcessingItem({ metadata: { payoutSubmissionPending: true } }),
    ]);

    await expect(
      service.reconcileFailedItemBeforeRetry(
        stuckProcessingItem({ metadata: { payoutSubmissionPending: true } }),
        'tenant-1',
      ),
    ).rejects.toThrow(/submission outcome is still unknown/);
  });

  it('leaves a recent null-transaction PROCESSING item alone until the grace window elapses', async () => {
    const { service, itemQueryBuilder, lifecycleNotify } = buildRequeryService([
      stuckProcessingItem({ updatedAt: new Date(Date.now() - 2 * 60 * 1000) }),
    ]);

    const result = await service.requeryStuckPayouts();

    expect(itemQueryBuilder.execute).not.toHaveBeenCalled();
    expect(lifecycleNotify.onItemFailed).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 1, updated: 0 });
  });

  it('does not second-fail an item that already carries a provider transaction id', async () => {
    const { service, itemQueryBuilder, queryStatus } = buildRequeryService(
      [stuckProcessingItem({ transactionId: 'pay_existing' })],
      { queryStatus: jest.fn().mockResolvedValue({ status: 'pending' }) },
    );

    await service.requeryStuckPayouts();

    expect(queryStatus).toHaveBeenCalledWith('pay_existing', expect.any(String));
    expect(itemQueryBuilder.execute).not.toHaveBeenCalled();
  });

  it('does not emit a second paid notification when the locked row is already paid', async () => {
    const { service, transactionRepository, lifecycleNotify } = createService();
    transactionRepository.findOne.mockResolvedValueOnce({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      payrollRunId: 'run-1',
      memberId: 'member-1',
      status: PayrollItemStatus.PAID,
      paymentAmount: 1000,
      metadata: {},
      payrollRun: {
        id: 'run-1',
        tenantId: 'tenant-1',
        createdById: 'admin-1',
      },
    });

    const changed = await service.applyTransferStatus(
      'pi_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'SUCCESS',
      'txn-duplicate',
      PaymentProvider.NOMBA,
      'tenant-1',
      1000,
    );

    expect(changed).toBe(false);
    expect(transactionRepository.save).not.toHaveBeenCalled();
    expect(lifecycleNotify.onItemPaid).not.toHaveBeenCalled();
  });
});
