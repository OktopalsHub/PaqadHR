import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import type { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import type { PayrollItemRepository } from '../repositories/payroll-item.repository';
import type { PayrollRunRepository } from '../repositories/payroll-run.repository';
import type { PayoutReconciliation } from './payout-reconciliation';
import { PayoutWebhooks } from './payout-webhooks';

describe('PayoutWebhooks Bachs status verification', () => {
  const merchantRef = 'pi_aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa';

  const createService = (verifiedStatus: string | null) => {
    const eventRepository = {
      createQueryBuilder: jest.fn(() => ({
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ identifiers: [{ id: 'event-1' }] }),
      })),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const itemRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        payrollRunId: 'run-1',
        payrollRun: { tenantId: 'tenant-1' },
      }),
    } as unknown as PayrollItemRepository;
    const reconciliation = {
      resolveTenantId: jest.fn().mockResolvedValue('tenant-1'),
      applyTransferStatus: jest.fn().mockResolvedValue(true),
      reconcilePayrollRunStatus: jest.fn().mockResolvedValue(undefined),
    } as unknown as PayoutReconciliation;
    const providerFactory = {
      resolvePayoutQuerier: jest.fn(() => ({
        queryStatus: jest
          .fn()
          .mockResolvedValue(
            verifiedStatus
              ? { status: verifiedStatus, amount: 1000, reference: merchantRef }
              : null,
          ),
      })),
    } as unknown as PaymentProviderFactoryService;
    const service = new PayoutWebhooks(
      {} as never,
      {} as never,
      {} as never,
      itemRepository,
      {} as unknown as PayrollRunRepository,
      reconciliation,
      eventRepository as never,
      providerFactory,
    );
    return { service, reconciliation, eventRepository, providerFactory };
  };

  it('uses the provider-queried status instead of the webhook status', async () => {
    const { service, reconciliation, providerFactory } = createService('FAILED');

    await service.processBachsPayload({
      type: 'payout.paid',
      data: {
        withdrawal_id: 'bachs-withdrawal-1',
        reference: merchantRef,
        status: 'completed',
        amount: '1.00',
        to_amount: '1000.00',
      },
    });

    expect(providerFactory.resolvePayoutQuerier).toHaveBeenCalledWith(PaymentProvider.BACHS);
    expect(reconciliation.applyTransferStatus).toHaveBeenCalledWith(
      merchantRef,
      'FAILED',
      'bachs-withdrawal-1',
      PaymentProvider.BACHS,
      'tenant-1',
      1000,
    );
  });

  it.each([
    1, 0,
  ])('atomically reclaims an expired webhook lease only when the update affects one row (affected=%s)', async (affected) => {
    const insertBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ identifiers: [] }),
    };
    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected }),
    };
    const eventRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(updateBuilder),
    };
    const service = new PayoutWebhooks(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      eventRepository as never,
      {} as never,
    );
    const claim = (
      service as unknown as {
        claimWebhookEvent: (provider: PaymentProvider, payload: unknown) => Promise<boolean>;
      }
    ).claimWebhookEvent;

    await expect(
      claim.call(service, PaymentProvider.BACHS, { id: 'duplicate-event-1' }),
    ).resolves.toBe(affected === 1);
    expect(updateBuilder.where).toHaveBeenCalledWith('"provider" = :provider', {
      provider: PaymentProvider.BACHS,
    });
    expect(updateBuilder.andWhere).toHaveBeenCalledWith('"processed_at" IS NULL');
    expect(updateBuilder.andWhere).toHaveBeenCalledWith(
      '"received_at" <= :leaseCutoff',
      expect.objectContaining({ leaseCutoff: expect.any(Date) }),
    );
  });

  it('does not change payroll state when Bachs status cannot be verified', async () => {
    const { service, reconciliation, eventRepository } = createService(null);

    await service.processBachsPayload({
      type: 'payout.paid',
      data: {
        withdrawal_id: 'bachs-withdrawal-2',
        reference: merchantRef,
        status: 'completed',
        amount: '1.00',
        to_amount: '1000.00',
      },
    });

    expect(reconciliation.applyTransferStatus).not.toHaveBeenCalled();
    expect(eventRepository.update).not.toHaveBeenCalled();
  });
});
