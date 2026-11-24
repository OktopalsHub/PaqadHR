import { ServiceUnavailableException } from '@nestjs/common';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import type { NoahApiService } from 'src/common/services/noah-api.service';
import type { NombaTransferApiService } from 'src/common/services/nomba-transfer-api.service';
import type { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import type { Repository } from 'typeorm';

import type { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import type { PayrollWebhookEvent } from '../entities/payroll-webhook-event.entity';
import type { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { buildPayrollMerchantRef } from '../utils/payroll-merchant-ref.util';
import { buildPayoutOps } from './payout-ops.testing';
import { PayoutWebhooks } from './payout-webhooks';
import { PayrollPayoutService } from './payroll-payout.service';

const RUN_ID = '11111111-1111-4111-8111-111111111111';
const ITEM_ID = '22222222-2222-4222-8222-222222222222';
// Derive the ref from the builder so these assertions track the current compact
// `pi_{itemHex}` format instead of a hardcoded legacy string.
const MERCHANT_REF = buildPayrollMerchantRef(RUN_ID, ITEM_ID);

/**
 * Webhook handlers claim each event with an INSERT ... ON CONFLICT DO NOTHING and mark it
 * processed afterwards, so the stub has to report one inserted row for a fresh event.
 */
function buildWebhookEventRepository() {
  const qb: Record<string, unknown> = {};
  qb.insert = jest.fn().mockReturnValue(qb);
  qb.into = jest.fn().mockReturnValue(qb);
  qb.values = jest.fn().mockReturnValue(qb);
  qb.orIgnore = jest.fn().mockReturnValue(qb);
  qb.execute = jest.fn().mockResolvedValue({ identifiers: [{ id: 'evt-1' }] });
  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  } as unknown as Repository<PayrollWebhookEvent>;
}

/**
 * PayrollPayoutService delegates to an internal PayoutReconciliation, so a spy on the
 * service method is never seen by the code under test. Reach the delegate directly.
 */
function spyOnReconciliation(
  service: PayrollPayoutService,
  method: 'applyTransferStatus',
): jest.SpyInstance {
  const { apply } = service as unknown as {
    apply: Record<string, (...args: never[]) => unknown>;
  };
  return jest.spyOn(apply, method) as unknown as jest.SpyInstance;
}

describe('PayrollPayoutService', () => {
  const createService = () => {
    const nombaTransferApi = {
      verifyWebhookSignature: jest.fn(),
      parseTransferWebhook: jest.fn(),
      getTransactionStatus: jest.fn(),
    } as unknown as NombaTransferApiService;

    const noahApi = {
      verifyWebhookSignature: jest.fn(),
      parseTransferWebhook: jest.fn(),
      verifyTransaction: jest.fn(),
    } as unknown as NoahApiService;

    const monnifyApi = {
      getDisbursementStatus: jest.fn(),
    };

    const fincraApi = {
      parsePayoutWebhook: jest.fn(),
      getPayoutStatus: jest.fn(),
    };

    const payrollItemRepository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
    } as unknown as PayrollItemRepository;

    const payrollItemRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    } as unknown as Repository<PayrollItem>;

    const payrollRunRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      // The sweep resolves owning tenants first so it never reads items across tenants.
      findDistinctTenantIdsWithProcessingItems: jest.fn().mockResolvedValue(['tenant-1']),
      findByIdWithItems: jest.fn().mockResolvedValue({
        id: RUN_ID,
        tenantId: 'tenant-1',
        items: [],
      }),
    };

    // applyTransferStatus works inside a transaction and resolves repositories from the
    // manager, so the item repository has to expose one for the row lock.
    const txManager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === PayrollRun ? payrollRunRepository : payrollItemRepository,
      ),
    };
    (payrollItemRepo as { manager?: unknown }).manager = {
      transaction: jest.fn(async (callback: (manager: typeof txManager) => Promise<boolean>) =>
        callback(txManager),
      ),
    };

    // requeryStuckPayouts goes through the factory's payout queriers, which are thin
    // adapters over the provider APIs. Wire the same adapters so stubbing
    // getTransactionStatus / getDisbursementStatus is enough to drive them.
    const factory = {
      resolvePayoutQuerier: jest.fn((provider: PaymentProvider) => {
        if (provider === PaymentProvider.NOMBA) {
          return {
            provider,
            queryStatus: async (transactionId: string) => {
              const status = await nombaTransferApi.getTransactionStatus(transactionId);
              return status ? { status } : null;
            },
          };
        }
        if (provider === PaymentProvider.MONNIFY) {
          return {
            provider,
            queryStatus: async (transactionId: string) => {
              const result = await monnifyApi.getDisbursementStatus(transactionId);
              return result?.status ? result : null;
            },
          };
        }
        return undefined;
      }),
    } as unknown as PaymentProviderFactoryService;

    const webhookEventRepository = buildWebhookEventRepository();

    const ops = buildPayoutOps(
      factory as never,
      payrollRunRepository as never,
      payrollItemRepo as never,
    );
    const webhooks = new PayoutWebhooks(
      nombaTransferApi,
      payrollItemRepository,
      ops.apply,
      ops.lookup,
      webhookEventRepository,
    );
    const service = new PayrollPayoutService(webhooks, ops.stuck, ops.retry, ops.apply, ops.lookup);

    return {
      service,
      webhookEventRepository,
      nombaTransferApi,
      noahApi,
      monnifyApi,
      fincraApi,
      payrollItemRepository,
      payrollItemRepo,
      payrollRunRepository,
    };
  };

  const baseItem = (): PayrollItem =>
    ({
      id: ITEM_ID,
      payrollRunId: RUN_ID,
      status: PayrollItemStatus.PROCESSING,
      paymentAmount: 1000,
      transactionId: null,
      paymentProvider: null,
      paidAt: null,
      failureReason: null,
    }) as PayrollItem;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('applyTransferStatus', () => {
    it('marks a processing item as paid on success status', async () => {
      const { service, payrollItemRepository } = createService();
      const item = baseItem();
      (payrollItemRepository.findOne as jest.Mock).mockResolvedValue(item);
      (payrollItemRepository.save as jest.Mock).mockImplementation(async (saved) => saved);

      const changed = await service.applyTransferStatus(MERCHANT_REF, 'SUCCESS', 'txn-123');

      expect(changed).toBe(true);
      expect(item.status).toBe(PayrollItemStatus.PAID);
      expect(item.transactionId).toBe('txn-123');
      expect(item.paymentProvider).toBe('Local bank transfer');
      expect(item.paidAt).toBeInstanceOf(Date);
      expect(item.failureReason).toBeNull();
    });

    it('is idempotent when item is already paid', async () => {
      const { service, payrollItemRepository } = createService();
      const item = { ...baseItem(), status: PayrollItemStatus.PAID };
      (payrollItemRepository.findOne as jest.Mock).mockResolvedValue(item);

      const changed = await service.applyTransferStatus(MERCHANT_REF, 'SUCCESS', 'txn-123');

      expect(changed).toBe(false);
      expect(payrollItemRepository.save).not.toHaveBeenCalled();
    });

    it('marks a processing item as paid on Settled status', async () => {
      const { service, payrollItemRepository } = createService();
      const item = baseItem();
      (payrollItemRepository.findOne as jest.Mock).mockResolvedValue(item);
      (payrollItemRepository.save as jest.Mock).mockImplementation(async (saved) => saved);

      const changed = await service.applyTransferStatus(MERCHANT_REF, 'Settled', 'txn-settled');

      expect(changed).toBe(true);
      expect(item.status).toBe(PayrollItemStatus.PAID);
    });

    it('does not downgrade a paid item on out-of-order failed webhook', async () => {
      const { service, payrollItemRepository } = createService();
      const item = { ...baseItem(), status: PayrollItemStatus.PAID };
      (payrollItemRepository.findOne as jest.Mock).mockResolvedValue(item);

      const changed = await service.applyTransferStatus(MERCHANT_REF, 'FAILED', 'txn-fail');

      expect(changed).toBe(false);
      expect(item.status).toBe(PayrollItemStatus.PAID);
      expect(payrollItemRepository.save).not.toHaveBeenCalled();
    });

    it('marks item as failed on failed transfer status', async () => {
      const { service, payrollItemRepository } = createService();
      const item = baseItem();
      (payrollItemRepository.findOne as jest.Mock).mockResolvedValue(item);
      (payrollItemRepository.save as jest.Mock).mockImplementation(async (saved) => saved);

      const changed = await service.applyTransferStatus(MERCHANT_REF, 'FAILED', 'txn-fail');

      expect(changed).toBe(true);
      expect(item.status).toBe(PayrollItemStatus.FAILED);
      expect(item.failureReason).toBe('Local bank transfer failed');
    });

    it('promotes pending item to processing on pending webhook', async () => {
      const { service, payrollItemRepository } = createService();
      const item = { ...baseItem(), status: PayrollItemStatus.PENDING };
      (payrollItemRepository.findOne as jest.Mock).mockResolvedValue(item);
      (payrollItemRepository.save as jest.Mock).mockImplementation(async (saved) => saved);

      const changed = await service.applyTransferStatus(MERCHANT_REF, 'PENDING', 'txn-pending');

      expect(changed).toBe(true);
      expect(item.status).toBe(PayrollItemStatus.PROCESSING);
      expect(item.transactionId).toBe('txn-pending');
    });

    it('returns false for invalid merchant reference', async () => {
      const { service, payrollItemRepository } = createService();

      const changed = await service.applyTransferStatus('invalid-ref', 'SUCCESS', 'txn-1');

      expect(changed).toBe(false);
      expect(payrollItemRepository.findOne).not.toHaveBeenCalled();
    });

    it('returns false when payroll item is missing', async () => {
      const { service, payrollItemRepository } = createService();
      (payrollItemRepository.findOne as jest.Mock).mockResolvedValue(null);

      const changed = await service.applyTransferStatus(MERCHANT_REF, 'SUCCESS', 'txn-1');

      expect(changed).toBe(false);
    });
  });

  describe('classifyPaymentResultStatus', () => {
    it('classifies provider statuses', () => {
      const { service } = createService();

      expect(service.classifyPaymentResultStatus('SUCCESS')).toBe('paid');
      expect(service.classifyPaymentResultStatus('Settled')).toBe('paid');
      expect(service.classifyPaymentResultStatus('FAILED')).toBe('failed');
      expect(service.classifyPaymentResultStatus('PROCESSING')).toBe('processing');
      expect(service.classifyPaymentResultStatus(undefined)).toBe('processing');
    });
  });

  describe('handleNombaWebhook', () => {
    it('rejects invalid signatures', async () => {
      const { service, nombaTransferApi } = createService();
      (nombaTransferApi.verifyWebhookSignature as jest.Mock).mockReturnValue(false);

      await expect(service.handleNombaWebhook('{}', 'bad-sig')).rejects.toThrow(
        'Invalid webhook signature',
      );
      expect(nombaTransferApi.parseTransferWebhook).not.toHaveBeenCalled();
    });

    it('applies transfer status for valid transfer webhooks', async () => {
      const { service, nombaTransferApi, payrollItemRepository } = createService();
      (nombaTransferApi.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
      (nombaTransferApi.parseTransferWebhook as jest.Mock).mockReturnValue({
        merchantTxRef: MERCHANT_REF,
        reference: 'txn-123',
        status: 'SUCCESS',
      });
      const rawBody = JSON.stringify({
        eventId: 'evt-1',
        reference: 'txn-123',
        merchantTxRef: MERCHANT_REF,
        status: 'SUCCESS',
      });
      (nombaTransferApi.getTransactionStatus as jest.Mock).mockResolvedValue('SUCCESS');
      const applySpy = spyOnReconciliation(service, 'applyTransferStatus').mockResolvedValue(true);
      (payrollItemRepository.findOne as jest.Mock).mockResolvedValue({
        ...baseItem(),
        payrollRun: { tenantId: 'tenant-1' },
      });

      const result = await service.handleNombaWebhook(rawBody, 'valid-sig');

      expect(result).toEqual({ received: true });
      expect(applySpy).toHaveBeenCalledWith(
        MERCHANT_REF,
        'SUCCESS',
        'txn-123',
        PaymentProvider.NOMBA,
        'tenant-1',
      );
    });

    describe('success events are confirmed with Nomba before paying', () => {
      const successEvent = {
        merchantTxRef: MERCHANT_REF,
        reference: 'txn-123',
        status: 'SUCCESS',
      };
      const setup = (providerStatus: string | null) => {
        const ctx = createService();
        (ctx.nombaTransferApi.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
        (ctx.nombaTransferApi.parseTransferWebhook as jest.Mock).mockReturnValue(successEvent);
        (ctx.nombaTransferApi.getTransactionStatus as jest.Mock).mockResolvedValue(providerStatus);
        (ctx.payrollItemRepository.findOne as jest.Mock).mockResolvedValue({
          ...baseItem(),
          payrollRun: { tenantId: 'tenant-1' },
        });
        const applySpy = spyOnReconciliation(ctx.service, 'applyTransferStatus').mockResolvedValue(
          true,
        );
        const rawBody = JSON.stringify({ eventId: 'evt-confirm', ...successEvent });
        return { ...ctx, applySpy, rawBody };
      };

      it('queries the status of the item merchant reference, not the event transaction id', async () => {
        const { service, nombaTransferApi, rawBody } = setup('SUCCESS');
        await service.handleNombaWebhook(rawBody, 'valid-sig');
        expect(nombaTransferApi.getTransactionStatus).toHaveBeenCalledWith(MERCHANT_REF);
      });

      it('does not pay when Nomba reports the item as not successful', async () => {
        const { service, applySpy, rawBody } = setup('PENDING');
        await service.handleNombaWebhook(rawBody, 'valid-sig');
        expect(applySpy).not.toHaveBeenCalledWith(
          MERCHANT_REF,
          'SUCCESS',
          expect.anything(),
          expect.anything(),
          expect.anything(),
        );
        expect(applySpy).toHaveBeenCalledWith(
          MERCHANT_REF,
          'PENDING',
          'txn-123',
          PaymentProvider.NOMBA,
          'tenant-1',
        );
      });

      it('returns 503 and releases the event claim when Nomba cannot confirm, so Nomba redelivers', async () => {
        const { service, applySpy, webhookEventRepository, rawBody } = setup(null);
        await expect(service.handleNombaWebhook(rawBody, 'valid-sig')).rejects.toBeInstanceOf(
          ServiceUnavailableException,
        );
        expect(applySpy).not.toHaveBeenCalled();
        expect(webhookEventRepository.delete).toHaveBeenCalledWith({
          provider: PaymentProvider.NOMBA,
          eventId: 'evt-confirm',
        });
      });
    });

    it('rejects malformed JSON', async () => {
      const { service, nombaTransferApi } = createService();
      (nombaTransferApi.verifyWebhookSignature as jest.Mock).mockReturnValue(true);

      await expect(service.handleNombaWebhook('not-json', 'valid-sig')).rejects.toThrow(
        'Invalid webhook JSON',
      );
      expect(nombaTransferApi.parseTransferWebhook).not.toHaveBeenCalled();
    });
  });

  describe('requeryStuckPayouts', () => {
    it('requeries Nomba and updates stuck processing items', async () => {
      const { service, nombaTransferApi, payrollItemRepo, payrollRunRepository } = createService();
      const stuckItem = {
        ...baseItem(),
        transactionId: 'txn-stuck',
        paymentProvider: 'Local bank transfer',
        updatedAt: new Date(Date.now() - 20 * 60 * 1000),
        payrollRun: { tenantId: 'tenant-1' },
      };
      (payrollItemRepo.find as jest.Mock).mockResolvedValue([stuckItem]);
      (nombaTransferApi.getTransactionStatus as jest.Mock).mockResolvedValue('SUCCESS');
      const applySpy = spyOnReconciliation(service, 'applyTransferStatus').mockResolvedValue(true);
      (payrollRunRepository as any).findByIdWithItems.mockResolvedValue({
        id: RUN_ID,
        tenantId: 'tenant-1',
        items: [stuckItem],
      });

      const result = await service.requeryStuckPayouts();

      expect(result).toEqual({ checked: 1, updated: 1 });
      expect(applySpy).toHaveBeenCalledWith(
        MERCHANT_REF,
        'SUCCESS',
        'txn-stuck',
        PaymentProvider.NOMBA,
        'tenant-1',
        undefined,
      );
    });

    it('uses the owning tenant resolved up front, never a per-item lookup', async () => {
      // The sweep resolves owning tenants before querying, so an item is always reconciled
      // against a tenant it provably belongs to. No per-item tenantId lookup is needed —
      // that fallback existed only because the old query had no tenant predicate.
      const { service, nombaTransferApi, payrollItemRepo, payrollRunRepository } = createService();
      const stuckItem = {
        ...baseItem(),
        transactionId: 'txn-stuck',
        paymentProvider: 'Local bank transfer',
        updatedAt: new Date(Date.now() - 20 * 60 * 1000),
        payrollRunId: RUN_ID,
        // deliberately no `payrollRun` relation loaded
      };
      (payrollItemRepo.find as jest.Mock).mockResolvedValue([stuckItem]);
      (nombaTransferApi.getTransactionStatus as jest.Mock).mockResolvedValue('SUCCESS');
      const applySpy = spyOnReconciliation(service, 'applyTransferStatus').mockResolvedValue(true);

      const result = await service.requeryStuckPayouts();

      expect(result).toEqual({ checked: 1, updated: 1 });
      expect(payrollRunRepository.findDistinctTenantIdsWithProcessingItems).toHaveBeenCalledTimes(
        1,
      );
      // Reconciled with the tenant from the owning-tenant query, with no extra lookup.
      expect(payrollRunRepository.findOne).not.toHaveBeenCalled();
      expect(applySpy).toHaveBeenCalledWith(
        MERCHANT_REF,
        'SUCCESS',
        'txn-stuck',
        PaymentProvider.NOMBA,
        'tenant-1',
        undefined,
      );
    });

    it('skips items without a transaction id', async () => {
      const { service, nombaTransferApi, payrollItemRepo } = createService();
      (payrollItemRepo.find as jest.Mock).mockResolvedValue([
        { ...baseItem(), transactionId: null },
      ]);

      const result = await service.requeryStuckPayouts();

      expect(result).toEqual({ checked: 1, updated: 0 });
      expect(nombaTransferApi.getTransactionStatus).not.toHaveBeenCalled();
    });
  });

  describe('amount mismatch', () => {
    it('does not mark paid when webhook amount mismatches item paymentAmount', async () => {
      const { service, payrollItemRepository, payrollRunRepository } = createService();
      const item = baseItem();
      (payrollRunRepository.findOne as jest.Mock).mockResolvedValue({ tenantId: 'tenant-1' });
      (payrollItemRepository.findOne as jest.Mock).mockResolvedValue(item);
      (payrollItemRepository.save as jest.Mock).mockImplementation(async (saved) => saved);

      const changed = await service.applyTransferStatus(
        MERCHANT_REF,
        'SUCCESS',
        'txn-1',
        PaymentProvider.NOMBA,
        'tenant-1',
        5000,
      );

      expect(changed).toBe(false);
      expect(item.status).toBe(PayrollItemStatus.PROCESSING);
      expect(payrollItemRepository.save).not.toHaveBeenCalled();
    });

    it('marks paid for FX-at-payout items, which have no pre-converted destination amount', async () => {
      const { service, payrollItemRepository, payrollRunRepository } = createService();
      const item = {
        ...baseItem(),
        paymentAmount: 0,
        metadata: { fxAtPayout: true },
      } as unknown as PayrollItem;
      (payrollRunRepository.findOne as jest.Mock).mockResolvedValue({ tenantId: 'tenant-1' });
      (payrollItemRepository.findOne as jest.Mock).mockResolvedValue(item);
      (payrollItemRepository.save as jest.Mock).mockImplementation(async (saved) => saved);

      const changed = await service.applyTransferStatus(
        MERCHANT_REF,
        'COMPLETED',
        'pay_bachs_1',
        PaymentProvider.BACHS,
        'tenant-1',
        1000,
      );

      expect(changed).toBe(true);
      expect(item.status).toBe(PayrollItemStatus.PAID);
      expect(item.paymentProvider).toBe('Bachs transfer');
      expect(item.transactionId).toBe('pay_bachs_1');
    });
  });

  describe('unknown provider status', () => {
    it('leaves PROCESSING items alone for unrecognized statuses', async () => {
      const { service, payrollItemRepository } = createService();
      const item = baseItem();
      (payrollItemRepository.findOne as jest.Mock).mockResolvedValue(item);

      const changed = await service.applyTransferStatus(
        MERCHANT_REF,
        'SOMETHING_WEIRD',
        'txn-unknown',
      );

      expect(changed).toBe(false);
      expect(item.status).toBe(PayrollItemStatus.PROCESSING);
      expect(payrollItemRepository.save).not.toHaveBeenCalled();
    });

    it('classifies blank/unknown createPayment statuses as processing (not failed)', () => {
      const { service } = createService();
      expect(service.classifyPaymentResultStatus(undefined)).toBe('processing');
      expect(service.classifyPaymentResultStatus('UNKNOWN_RAIL_STATE')).toBe('processing');
    });
  });
});
