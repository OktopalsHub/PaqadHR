import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollFundingLedgerEventType } from '../entities/payroll-run-funding-ledger-entry.entity';
import { PayrollRunFundingLedgerService } from './payroll-run-funding-ledger.service';

describe('PayrollRunFundingLedgerService', () => {
  let service: PayrollRunFundingLedgerService;
  let repository: {
    findOne: jest.Mock;
    insert: jest.Mock;
    find: jest.Mock;
    manager?: { transaction: jest.Mock };
  };

  const input = {
    tenantId: 'tenant-1',
    payrollRunId: 'run-1',
    amount: 1250.5,
    currency: 'ngn',
    provider: 'BACHS',
    providerReference: 'checkout-123',
    performedById: 'member-1',
    evidence: { verifiedStatus: 'success', verifiedAmount: 1250.5 },
  };

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      insert: jest.fn(),
      find: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === PayrollRun) {
          return {
            findOne: jest.fn().mockResolvedValue({
              id: input.payrollRunId,
              tenantId: input.tenantId,
            }),
          };
        }
        return repository;
      }),
    };
    repository.manager = {
      transaction: jest.fn(async (callback: (tx: typeof manager) => Promise<void>) =>
        callback(manager),
      ),
    } as never;
    service = new PayrollRunFundingLedgerService(repository as never);
  });

  it('records verified funding in the run-scoped ledger', async () => {
    repository.findOne.mockResolvedValue(null);
    repository.insert.mockResolvedValue({ identifiers: [{ id: 'entry-1' }] });

    await service.recordVerifiedFunding(input);

    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: input.tenantId,
        payrollRunId: input.payrollRunId,
        eventType: PayrollFundingLedgerEventType.FUNDING_RECEIVED,
        amount: '1250.50',
        currency: 'NGN',
        provider: 'BACHS',
        providerReference: 'checkout-123',
        idempotencyKey: 'funding:checkout-123',
      }),
    );
  });

  it('does not create a duplicate entry for the same verified checkout', async () => {
    repository.findOne.mockResolvedValue({
      tenantId: input.tenantId,
      payrollRunId: input.payrollRunId,
      amount: '1250.50',
      currency: 'NGN',
    });

    await service.recordVerifiedFunding(input);

    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('rejects reusing a checkout reference for another run', async () => {
    repository.findOne.mockResolvedValue({
      tenantId: input.tenantId,
      payrollRunId: 'another-run',
      amount: '1250.50',
      currency: 'NGN',
    });

    await expect(service.recordVerifiedFunding(input)).rejects.toThrow(
      'Funding reference was already allocated to a different payroll transaction',
    );
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('rejects non-positive funding amounts', async () => {
    await expect(service.recordVerifiedFunding({ ...input, amount: 0 })).rejects.toThrow(
      'Verified payroll funding amount must be positive',
    );
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('records provider-confirmed payout debits in the source currency', async () => {
    repository.findOne.mockResolvedValue(null);
    repository.insert.mockResolvedValue({ identifiers: [{ id: 'debit-1' }] });

    await service.recordConfirmedPayoutDebit({
      tenantId: input.tenantId,
      payrollRunId: input.payrollRunId,
      payrollItemId: 'item-1',
      amount: 40.25,
      currency: 'usd',
      provider: 'BACHS',
      providerReference: 'payout-123',
      evidence: { verifiedStatus: 'completed' },
    });

    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: PayrollFundingLedgerEventType.PAYOUT_CONFIRMED,
        payrollItemId: 'item-1',
        amount: '40.25',
        currency: 'USD',
        idempotencyKey: 'payout:BACHS:payout-123',
      }),
    );
  });

  it('does not authorize retries from funding credits alone', async () => {
    repository.find.mockResolvedValue([
      {
        eventType: PayrollFundingLedgerEventType.FUNDING_RECEIVED,
        amount: '1250.50',
        currency: 'NGN',
      },
    ]);

    const result = await service.getRunLedger(input.tenantId, input.payrollRunId);

    expect(result.verifiedFundingByCurrency).toEqual({ NGN: 1250.5 });
    expect(result.fundingEvidenceComplete).toBe(false);
    expect(result.retryAuthorization).toBe('blocked');
  });

  describe('reserveFailedPayout', () => {
    const buildTransactionalRepository = (options?: {
      run?: Record<string, unknown> | null;
      items?: Array<Record<string, unknown>>;
      entries?: Array<Record<string, unknown>>;
      existing?: Record<string, unknown> | null;
    }) => {
      const ledger = {
        findOne: jest.fn().mockResolvedValue(options?.existing ?? null),
        find: jest.fn().mockResolvedValue(options?.entries ?? []),
        insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 'reservation-1' }] }),
      };
      const runs = {
        findOne: jest.fn().mockResolvedValue(
          options?.run ?? {
            id: input.payrollRunId,
            tenantId: input.tenantId,
            status: 'approved',
          },
        ),
      };
      const items = {
        find: jest.fn().mockResolvedValue(
          options?.items ?? [
            {
              id: 'item-failed',
              status: 'failed',
              metadata: {},
            },
          ],
        ),
      };
      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === PayrollRun) return runs;
          if (entity === PayrollItem) return items;
          return ledger;
        }),
      };
      repository.manager = {
        transaction: jest.fn(async (callback: (tx: typeof manager) => Promise<void>) =>
          callback(manager),
        ),
      } as never;
      return { ledger, runs, items, manager };
    };

    it('reserves run-scoped funds atomically for a confirmed failed item', async () => {
      const { ledger } = buildTransactionalRepository({
        entries: [
          {
            eventType: PayrollFundingLedgerEventType.FUNDING_RECEIVED,
            amount: '100.00',
            currency: 'USD',
            payrollItemId: null,
          },
        ],
      });

      await service.reserveFailedPayout({
        tenantId: input.tenantId,
        payrollRunId: input.payrollRunId,
        payrollItemId: 'item-failed',
        amount: 40,
        currency: 'USD',
        provider: 'BACHS',
        reservationKey: 'item-failed-attempt-2',
        performedById: 'member-1',
        evidence: { quoteReference: 'quote-1' },
      });

      expect(ledger.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: PayrollFundingLedgerEventType.PAYOUT_RESERVED,
          amount: '40.00',
          currency: 'USD',
          payrollItemId: 'item-failed',
          idempotencyKey: 'reservation:run-1:item-failed-attempt-2',
        }),
      );
    });

    it('blocks reservations when any payout is still pending or processing', async () => {
      buildTransactionalRepository({
        items: [
          { id: 'item-failed', status: 'failed', metadata: {} },
          { id: 'item-live', status: 'processing', metadata: {} },
        ],
        entries: [
          {
            eventType: PayrollFundingLedgerEventType.FUNDING_RECEIVED,
            amount: '100.00',
            currency: 'USD',
            payrollItemId: null,
          },
        ],
      });

      await expect(
        service.reserveFailedPayout({
          tenantId: input.tenantId,
          payrollRunId: input.payrollRunId,
          payrollItemId: 'item-failed',
          amount: 40,
          currency: 'USD',
          provider: 'BACHS',
          reservationKey: 'attempt-2',
          performedById: 'member-1',
          evidence: {},
        }),
      ).rejects.toThrow('Cannot reserve funds while any payout outcome remains unresolved');
    });

    it('blocks reservations when the verified run-scoped balance is insufficient', async () => {
      const { ledger } = buildTransactionalRepository({
        entries: [
          {
            eventType: PayrollFundingLedgerEventType.FUNDING_RECEIVED,
            amount: '30.00',
            currency: 'USD',
            payrollItemId: null,
          },
        ],
      });

      await expect(
        service.reserveFailedPayout({
          tenantId: input.tenantId,
          payrollRunId: input.payrollRunId,
          payrollItemId: 'item-failed',
          amount: 40,
          currency: 'USD',
          provider: 'BACHS',
          reservationKey: 'attempt-2',
          performedById: 'member-1',
          evidence: {},
        }),
      ).rejects.toThrow('Insufficient verified run-scoped funds');
      expect(ledger.insert).not.toHaveBeenCalled();
    });
  });
});
