import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
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
      find: jest.fn().mockResolvedValue([]),
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

  it('records an approval for the exact selected failed payouts', async () => {
    const selectedItemIds = ['item-2', 'item-1'];
    const ledgerRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 'approval-1' }] }),
      find: jest.fn().mockResolvedValue([]),
    };
    const itemRepository = {
      find: jest.fn().mockResolvedValue([
        { id: 'item-1', status: PayrollItemStatus.FAILED },
        { id: 'item-2', status: PayrollItemStatus.FAILED },
      ]),
    };
    const runRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: input.payrollRunId,
        tenantId: input.tenantId,
        status: PayrollStatus.APPROVED,
      }),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === PayrollRun) return runRepository;
        if (entity === PayrollItem) return itemRepository;
        return ledgerRepository;
      }),
    };
    repository.manager = {
      transaction: jest.fn(async (callback: (tx: typeof manager) => Promise<void>) =>
        callback(manager),
      ),
    } as never;

    await service.recordRetryShortfallApproval({
      tenantId: input.tenantId,
      payrollRunId: input.payrollRunId,
      selectedItemIds,
      amount: 80,
      currency: 'usd',
      approvedById: 'member-1',
      provider: 'BACHS',
      approvalReference: 'retry-order-1',
    });

    expect(ledgerRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: PayrollFundingLedgerEventType.SHORTFALL_APPROVED,
        amount: '80.00',
        currency: 'USD',
        approvedById: 'member-1',
        idempotencyKey: `shortfall-approval:${input.payrollRunId}:retry-order-1`,
        evidence: expect.objectContaining({
          selectedItemIds: 'item-1,item-2',
          approvalStatus: 'approved',
        }),
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

  describe('releaseFailedPayoutReservation', () => {
    const releaseInput = {
      tenantId: input.tenantId,
      payrollRunId: input.payrollRunId,
      payrollItemId: 'item-failed',
      reservationKey: 'item-failed-attempt-2',
      provider: 'BACHS',
      providerReference: 'payout-final-failed',
      performedById: 'member-1',
      evidence: { verifiedStatus: 'FAILED' },
    };

    it('releases a reservation only after a provider-confirmed terminal failure', async () => {
      repository.findOne
        .mockResolvedValueOnce({
          tenantId: input.tenantId,
          payrollRunId: input.payrollRunId,
          payrollItemId: releaseInput.payrollItemId,
          eventType: PayrollFundingLedgerEventType.PAYOUT_RESERVED,
          amount: '40.00',
          currency: 'USD',
        })
        .mockResolvedValueOnce(null);
      repository.find.mockResolvedValue([]);

      await service.releaseFailedPayoutReservation(releaseInput);

      expect(repository.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: PayrollFundingLedgerEventType.RESERVATION_RELEASED,
          amount: '40.00',
          currency: 'USD',
          payrollItemId: releaseInput.payrollItemId,
          idempotencyKey:
            'reservation-release:item-failed-attempt-2:failure:BACHS:payout-final-failed',
          evidence: expect.objectContaining({
            verifiedStatus: 'FAILED',
            releasedReservationKey: releaseInput.reservationKey,
          }),
        }),
      );
    });

    it('does not release reserved funds after a payout debit is confirmed', async () => {
      repository.findOne
        .mockResolvedValueOnce({
          tenantId: input.tenantId,
          payrollRunId: input.payrollRunId,
          payrollItemId: releaseInput.payrollItemId,
          eventType: PayrollFundingLedgerEventType.PAYOUT_RESERVED,
          amount: '40.00',
          currency: 'USD',
        })
        .mockResolvedValueOnce(null);
      repository.find.mockResolvedValue([
        {
          eventType: PayrollFundingLedgerEventType.PAYOUT_CONFIRMED,
          payrollItemId: releaseInput.payrollItemId,
          amount: '40.00',
          currency: 'USD',
        },
      ]);

      await service.releaseFailedPayoutReservation(releaseInput);

      expect(repository.insert).not.toHaveBeenCalled();
    });

    it('keeps the reservation when the provider outcome is pending or unknown', async () => {
      await expect(
        service.releaseFailedPayoutReservation({
          ...releaseInput,
          evidence: { verifiedStatus: 'PENDING' },
        }),
      ).rejects.toThrow(
        'A payout reservation can only be released with a provider-confirmed terminal failure',
      );
      expect(repository.insert).not.toHaveBeenCalled();
    });
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

  it('releases active item reservations when a provider confirms terminal failure', async () => {
    const entries = [
      {
        eventType: PayrollFundingLedgerEventType.PAYOUT_RESERVED,
        payrollItemId: 'item-failed',
        amount: '40.00',
        currency: 'USD',
        evidence: { reservationKey: 'item-failed-attempt-1' },
      },
    ];
    const ledger = {
      find: jest.fn().mockResolvedValue(entries),
      findOne: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 'release-1' }] }),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === PayrollRun
          ? {
              findOne: jest.fn().mockResolvedValue({
                id: input.payrollRunId,
                tenantId: input.tenantId,
              }),
            }
          : ledger,
      ),
    };
    repository.manager = {
      transaction: jest.fn(async (callback: (tx: typeof manager) => Promise<number>) =>
        callback(manager),
      ),
    } as never;

    const released = await service.releaseFailedPayoutReservationsForItem({
      tenantId: input.tenantId,
      payrollRunId: input.payrollRunId,
      payrollItemId: 'item-failed',
      provider: 'BACHS',
      providerReference: 'payout-final-failed',
      evidence: {
        verifiedStatus: 'FAILED',
        verificationSource: 'provider_status_query',
      },
    });

    expect(released).toBe(1);
    expect(ledger.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: PayrollFundingLedgerEventType.RESERVATION_RELEASED,
        payrollItemId: 'item-failed',
        idempotencyKey:
          'reservation-release:item-failed-attempt-1:failure:BACHS:payout-final-failed',
        evidence: expect.objectContaining({
          verifiedStatus: 'FAILED',
          releasedReservationKey: 'item-failed-attempt-1',
        }),
      }),
    );
  });
});
