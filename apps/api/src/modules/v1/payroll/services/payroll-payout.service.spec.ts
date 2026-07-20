import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import type { NoahApiService } from 'src/common/services/noah-api.service';
import type { NombaTransferApiService } from 'src/common/services/nomba-transfer-api.service';
import type { Repository } from 'typeorm';
import type { PayrollItem } from '../entities/payroll-item.entity';
import type { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollPayoutService } from './payroll-payout.service';

const RUN_ID = '11111111-1111-4111-8111-111111111111';
const ITEM_ID = '22222222-2222-4222-8222-222222222222';
const MERCHANT_REF = `payroll_${RUN_ID}_${ITEM_ID}`;

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

    const payrollItemRepository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
    } as unknown as PayrollItemRepository;

    const payrollItemRepo = {
      find: jest.fn(),
    } as unknown as Repository<PayrollItem>;

    const payrollRunRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const service = new PayrollPayoutService(
      nombaTransferApi,
      noahApi,
      payrollItemRepository,
      payrollRunRepository as never,
      payrollItemRepo,
    );

    return {
      service,
      nombaTransferApi,
      noahApi,
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
      expect(item.paymentProvider).toBe('Nomba');
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
      expect(item.failureReason).toBe('Nomba transfer failed');
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
      const { service, nombaTransferApi } = createService();
      const rawBody = JSON.stringify({ event_type: 'transfer.success' });
      (nombaTransferApi.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
      (nombaTransferApi.parseTransferWebhook as jest.Mock).mockReturnValue({
        eventId: 'evt-1',
        reference: 'txn-123',
        merchantTxRef: MERCHANT_REF,
        status: 'SUCCESS',
      });
      const applySpy = jest.spyOn(service, 'applyTransferStatus').mockResolvedValue(true);

      const result = await service.handleNombaWebhook(rawBody, 'valid-sig');

      expect(result).toEqual({ received: true });
      expect(applySpy).toHaveBeenCalledWith(MERCHANT_REF, 'SUCCESS', 'txn-123', 'nomba');
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

  describe('processNoahPayload', () => {
    it('resolves payroll item by transaction id when external id is absent', async () => {
      const { service, noahApi, payrollItemRepository } = createService();
      const txnId = '0ee0ed7a-57eb-5818-bd11-67cccd940e3e';
      const item = { ...baseItem(), transactionId: txnId };
      (noahApi.parseTransferWebhook as jest.Mock).mockReturnValue({
        merchantTxRef: txnId,
        reference: txnId,
        status: 'SETTLED',
      });
      (payrollItemRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(item)
        .mockResolvedValueOnce(item);
      (payrollItemRepository.save as jest.Mock).mockImplementation(async (saved) => saved);
      (payrollItemRepository.find as jest.Mock).mockResolvedValue([item]);
      const payrollRunRepository = (service as any).payrollRunRepository;
      payrollRunRepository.findOne.mockResolvedValue({ id: RUN_ID, status: 'PROCESSING' });

      const result = await service.processNoahPayload({
        EventType: 'Transaction',
        Data: { ID: txnId, Status: 'Settled' },
      });

      expect(result.matched).toBe(true);
      expect(item.status).toBe(PayrollItemStatus.PAID);
    });
  });

  describe('requeryStuckPayouts', () => {
    it('requeries Nomba and updates stuck processing items', async () => {
      const { service, nombaTransferApi, payrollItemRepo } = createService();
      const stuckItem = {
        ...baseItem(),
        transactionId: 'txn-stuck',
        updatedAt: new Date(Date.now() - 20 * 60 * 1000),
      };
      (payrollItemRepo.find as jest.Mock).mockResolvedValue([stuckItem]);
      (nombaTransferApi.getTransactionStatus as jest.Mock).mockResolvedValue('SUCCESS');
      const applySpy = jest.spyOn(service, 'applyTransferStatus').mockResolvedValue(true);

      const result = await service.requeryStuckPayouts();

      expect(result).toEqual({ checked: 1, updated: 1 });
      expect(applySpy).toHaveBeenCalledWith(MERCHANT_REF, 'SUCCESS', 'txn-stuck', 'nomba');
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
});
