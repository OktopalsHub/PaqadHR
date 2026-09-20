import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import type { PayrollItem } from '../entities/payroll-item.entity';
import type { PayrollItemRepository } from '../repositories/payroll-item.repository';
import type { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { PayoutReconciliation } from './payout-reconciliation';

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
    const manager = {
      getRepository: jest.fn().mockReturnValue(transactionRepository),
    };
    const payrollItemRepo = {
      manager: {
        transaction: jest.fn(async (callback: (txManager: typeof manager) => Promise<boolean>) =>
          callback(manager),
        ),
      },
    } as unknown as import('typeorm').Repository<PayrollItem>;

    const payrollItemRepository = {} as PayrollItemRepository;
    const payrollRunRepository = {
      findOne: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
    } as unknown as PayrollRunRepository;
    const factory = {} as never;
    const fincraApi = {} as never;
    const lifecycleNotify = {
      onItemPaid: jest.fn().mockResolvedValue(undefined),
      onItemFailed: jest.fn().mockResolvedValue(undefined),
    };

    const service = new PayoutReconciliation(
      fincraApi,
      factory,
      payrollItemRepository,
      payrollRunRepository,
      payrollItemRepo,
      lifecycleNotify,
    );

    return { service, transactionRepository, lifecycleNotify };
  };

  it('serializes duplicate success webhooks with a row lock', async () => {
    const { service, transactionRepository, lifecycleNotify } = createService();

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
    expect(lifecycleNotify.onItemPaid).toHaveBeenCalledTimes(1);
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
