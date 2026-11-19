import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';

import type { PayrollItem } from '../entities/payroll-item.entity';
import { MultiPaymentService } from './multi-payment.service';

const audit = { tenantId: 't1', payrollRunId: 'run-1', performedById: 'admin-1' };

const makeItem = (overrides: Partial<PayrollItem> = {}): PayrollItem =>
  ({
    id: 'item-1',
    status: PayrollItemStatus.PENDING,
    paymentCurrency: 'USD',
    paymentProvider: null,
    metadata: {},
    ...overrides,
  }) as PayrollItem;

const makeRun = (items: PayrollItem[], overrides: Record<string, unknown> = {}) => ({
  id: 'run-1',
  tenantId: 't1',
  status: PayrollStatus.APPROVED,
  payoutMode: 'immediate',
  metadata: {},
  items,
  ...overrides,
});

const setup = (claimAffected = 1) => {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['update', 'set', 'where', 'andWhere']) qb[m] = jest.fn().mockReturnValue(qb);
  qb.execute = jest.fn().mockResolvedValue({ affected: claimAffected });
  const runRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
  };
  const itemRepo = { findByPayrollRunId: jest.fn() };
  const payoutService = {
    reconcilePayrollRunStatus: jest.fn().mockResolvedValue(undefined),
    reconcileFailedItemBeforeRetry: jest.fn().mockResolvedValue(true),
  };
  const bridge = { processRun: jest.fn().mockResolvedValue([]) };
  const nomba = { processRun: jest.fn().mockResolvedValue([]) };
  const service = new MultiPaymentService(
    runRepo as never,
    itemRepo as never,
    payoutService as never,
    bridge as never,
    nomba as never,
  );
  return { service, runRepo, payoutService, bridge, nomba, qb };
};

describe('MultiPaymentService', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  describe('processMultiPaymentPayroll', () => {
    it('throws when the run does not exist', async () => {
      const { service, runRepo } = setup();
      runRepo.findOne.mockResolvedValue(null);
      await expect(service.processMultiPaymentPayroll('run-1', 't1', audit)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects a run that is not approved', async () => {
      const { service, runRepo } = setup();
      runRepo.findOne.mockResolvedValue(makeRun([makeItem()], { status: PayrollStatus.DRAFT }));
      await expect(service.processMultiPaymentPayroll('run-1', 't1', audit)).rejects.toThrow(
        /must be approved/,
      );
    });

    it('requires a completed Nomba checkout before paying NGN items', async () => {
      const { service, runRepo, nomba } = setup();
      runRepo.findOne.mockResolvedValue(makeRun([makeItem({ paymentCurrency: 'NGN' })]));
      await expect(service.processMultiPaymentPayroll('run-1', 't1', audit)).rejects.toThrow(
        /funded through its Nomba checkout/,
      );
      expect(nomba.processRun).not.toHaveBeenCalled();
    });

    it('routes NGN items to Nomba once the checkout completed', async () => {
      const { service, runRepo, nomba, bridge } = setup();
      const item = makeItem({ paymentCurrency: 'NGN' });
      runRepo.findOne.mockResolvedValue(
        makeRun([item], { metadata: { floatTopup: { status: 'completed', provider: 'nomba' } } }),
      );
      nomba.processRun.mockResolvedValue([{ success: true, status: 'completed' }]);
      const result = await service.processMultiPaymentPayroll('run-1', 't1', audit);
      expect(nomba.processRun).toHaveBeenCalledWith(expect.anything(), [item], 't1');
      expect(bridge.processRun).not.toHaveBeenCalled();
      expect(result.totalItems).toBe(1);
    });

    it('refuses Bridge items when Bridge is not configured', async () => {
      delete process.env.BRIDGE_API_KEY;
      const { service, runRepo, bridge } = setup();
      runRepo.findOne.mockResolvedValue(makeRun([makeItem()]));
      await expect(service.processMultiPaymentPayroll('run-1', 't1', audit)).rejects.toThrow(
        /Bridge payroll is not configured/,
      );
      expect(bridge.processRun).not.toHaveBeenCalled();
    });

    it('rejects when another worker holds the processing claim', async () => {
      const { service, runRepo, nomba, bridge } = setup(0);
      runRepo.findOne.mockResolvedValue(makeRun([makeItem()]));
      await expect(service.processMultiPaymentPayroll('run-1', 't1', audit)).rejects.toThrow(
        'Payroll run is already being processed',
      );
      expect(nomba.processRun).not.toHaveBeenCalled();
      expect(bridge.processRun).not.toHaveBeenCalled();
    });

    it('reconciles and explains when nothing is payable', async () => {
      const { service, runRepo, payoutService, qb } = setup();
      runRepo.findOne.mockResolvedValue(makeRun([makeItem({ status: PayrollItemStatus.PAID })]));
      await expect(service.processMultiPaymentPayroll('run-1', 't1', audit)).rejects.toThrow(
        /already been paid/,
      );
      expect(payoutService.reconcilePayrollRunStatus).toHaveBeenCalledWith('run-1', 't1');
      expect(qb.set).toHaveBeenLastCalledWith({
        processingLockedAt: null,
        processingLockedById: null,
      });
    });
  });

  describe('retryFailedPayments', () => {
    it('rejects items from another provider until the original provider confirms terminal', async () => {
      const { service, runRepo } = setup();
      runRepo.findOne.mockResolvedValue(
        makeRun([
          makeItem({ status: PayrollItemStatus.FAILED, paymentProvider: 'Bachs transfer' }),
        ]),
      );
      await expect(service.retryFailedPayments('run-1', 't1', audit)).rejects.toThrow(
        /legacy-provider payout/,
      );
    });

    it('rejects selections that are not failed items of the run', async () => {
      const { service, runRepo } = setup();
      runRepo.findOne.mockResolvedValue(makeRun([makeItem({ status: PayrollItemStatus.PAID })]));
      await expect(service.retryFailedPayments('run-1', 't1', audit, ['item-1'])).rejects.toThrow(
        /Only failed payroll items/,
      );
      await expect(service.retryFailedPayments('run-1', 't1', audit, ['nope'])).rejects.toThrow(
        /do not belong/,
      );
    });

    it('blocks an NGN retry that Nomba no longer confirms as failed', async () => {
      const { service, runRepo, payoutService, nomba } = setup();
      runRepo.findOne.mockResolvedValue(
        makeRun([makeItem({ status: PayrollItemStatus.FAILED, paymentCurrency: 'NGN' })]),
      );
      payoutService.reconcileFailedItemBeforeRetry.mockResolvedValue(false);
      await expect(service.retryFailedPayments('run-1', 't1', audit)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(nomba.processRun).not.toHaveBeenCalled();
    });

    it('retries a Nomba-confirmed failed NGN item through Nomba', async () => {
      const { service, runRepo, nomba } = setup();
      const item = makeItem({
        status: PayrollItemStatus.FAILED,
        paymentCurrency: 'NGN',
        paymentProvider: 'nomba',
      });
      runRepo.findOne.mockResolvedValue(makeRun([item]));
      await service.retryFailedPayments('run-1', 't1', audit);
      expect(nomba.processRun).toHaveBeenCalledWith(expect.anything(), [item], 't1');
    });
  });
});
