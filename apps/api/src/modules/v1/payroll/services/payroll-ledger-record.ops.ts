import { EntityManager, Repository } from 'typeorm';

import {
  PayrollFundingLedgerEventType,
  PayrollRunFundingLedgerEntry,
} from '../entities/payroll-run-funding-ledger-entry.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { type VerifiedPayrollFundingInput } from './payroll-run-funding-ledger.shared';

export class LedgerRecordOps {
  constructor(private readonly ledgerRepository: Repository<PayrollRunFundingLedgerEntry>) {}

  /**
   * Append a provider-verified funding event. The provider reference is the idempotency key:
   * webhook retries cannot create additional funding credit for the same checkout.
   */
  async recordVerifiedFunding(
    input: VerifiedPayrollFundingInput,
    manager?: EntityManager,
  ): Promise<void> {
    const amount = Math.round(input.amount * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Verified payroll funding amount must be positive');
    }
    const currency = input.currency.trim().toUpperCase();
    const provider = input.provider.trim();
    const providerReference = input.providerReference.trim();
    if (!currency || !provider || !providerReference) {
      throw new Error(
        'Verified payroll funding requires provider, currency, and provider reference',
      );
    }

    const idempotencyKey = `funding:${providerReference}`;
    const matchesExisting = (entry: PayrollRunFundingLedgerEntry | null) =>
      Boolean(
        entry &&
        entry.eventType === PayrollFundingLedgerEventType.FUNDING_RECEIVED &&
        entry.tenantId === input.tenantId &&
        entry.payrollRunId === input.payrollRunId &&
        entry.provider === provider &&
        Number(entry.amount) === amount &&
        entry.currency === currency,
      );

    const write = async (tx: EntityManager) => {
      // Validate tenant/run ownership at the persistence boundary, not only in callers.
      // Locking the run also serializes funding credits for the same payroll run.
      const run = await tx.getRepository(PayrollRun).findOne({
        where: { id: input.payrollRunId, tenantId: input.tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!run) throw new Error('Payroll run not found for verified funding allocation');

      const ledger = tx.getRepository(PayrollRunFundingLedgerEntry);
      const existing = await ledger.findOne({ where: { idempotencyKey } });
      if (existing) {
        if (!matchesExisting(existing)) {
          throw new Error(
            'Funding reference was already allocated to a different payroll transaction',
          );
        }
        return;
      }

      await ledger.insert({
        tenantId: input.tenantId,
        payrollRunId: input.payrollRunId,
        eventType: PayrollFundingLedgerEventType.FUNDING_RECEIVED,
        amount: amount.toFixed(2),
        currency,
        provider,
        providerReference,
        idempotencyKey,
        performedById: input.performedById ?? null,
        approvedById: null,
        evidence: input.evidence ?? null,
      });
    };

    // Inside a caller's transaction a failed insert would abort it, so errors propagate and the
    // caller rolls back; the standalone path re-reads after a unique-reference race instead.
    if (manager) {
      await write(manager);
      return;
    }
    try {
      await this.ledgerRepository.manager.transaction(write);
    } catch (error) {
      // A duplicate provider callback may race on the globally unique reference. Re-read
      // outside the failed transaction and accept only an exact match.
      const raced = await this.ledgerRepository.findOne({ where: { idempotencyKey } });
      if (!matchesExisting(raced)) throw error;
    }
  }

  /**
   * Check whether a paid item already has a confirmed debit in its own run ledger.
   * Used by reconciliation to find gaps without assuming payroll status proves money movement.
   */
  async hasConfirmedPayoutDebit(input: {
    tenantId: string;
    payrollRunId: string;
    payrollItemId: string;
  }): Promise<boolean> {
    const entry = await this.ledgerRepository.findOne({
      where: {
        tenantId: input.tenantId,
        payrollRunId: input.payrollRunId,
        payrollItemId: input.payrollItemId,
        eventType: PayrollFundingLedgerEventType.PAYOUT_CONFIRMED,
      },
    });
    return Boolean(entry);
  }

  /**
   * Credit back a confirmed payout debit after the provider reports the payout reversed or
   * refunded. Idempotent per provider reference; requires an existing confirmed debit for the
   * item and never reverses the same debit twice.
   */
  async recordPayoutReversal(input: {
    tenantId: string;
    payrollRunId: string;
    payrollItemId: string;
    provider: string;
    providerReference: string;
    evidence?: Record<string, string | number | boolean | null>;
  }): Promise<'recorded' | 'already_recorded' | 'no_confirmed_debit'> {
    const providerReference = input.providerReference.trim();
    if (!providerReference) throw new Error('A payout reversal requires a provider reference');
    const idempotencyKey = `payout-reversal:${input.provider}:${providerReference}`;

    return this.ledgerRepository.manager.transaction(async (manager) => {
      const run = await manager.getRepository(PayrollRun).findOne({
        where: { id: input.payrollRunId, tenantId: input.tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!run) throw new Error('Payroll run not found for payout reversal');

      const ledger = manager.getRepository(PayrollRunFundingLedgerEntry);
      const existing = await ledger.findOne({ where: { idempotencyKey } });
      if (existing) {
        if (
          existing.tenantId !== input.tenantId ||
          existing.payrollRunId !== input.payrollRunId ||
          existing.payrollItemId !== input.payrollItemId
        ) {
          throw new Error(
            'Payout reversal reference was already allocated to a different payroll transaction',
          );
        }
        return 'already_recorded';
      }

      const itemEntries = await ledger.find({
        where: {
          tenantId: input.tenantId,
          payrollRunId: input.payrollRunId,
          payrollItemId: input.payrollItemId,
        },
      });
      const debit = itemEntries.find(
        (entry) =>
          entry.eventType === PayrollFundingLedgerEventType.PAYOUT_CONFIRMED &&
          entry.providerReference === providerReference,
      );
      if (!debit) return 'no_confirmed_debit';
      const alreadyReversed = itemEntries.some(
        (entry) =>
          entry.eventType === PayrollFundingLedgerEventType.PAYOUT_REVERSED &&
          entry.evidence?.reversedDebitKey === debit.idempotencyKey,
      );
      if (alreadyReversed) return 'already_recorded';

      await ledger.insert({
        tenantId: input.tenantId,
        payrollRunId: input.payrollRunId,
        payrollItemId: input.payrollItemId,
        eventType: PayrollFundingLedgerEventType.PAYOUT_REVERSED,
        amount: debit.amount,
        currency: debit.currency,
        provider: input.provider,
        providerReference,
        idempotencyKey,
        performedById: null,
        approvedById: null,
        evidence: {
          ...(input.evidence ?? {}),
          reversedDebitKey: debit.idempotencyKey,
          reason: 'provider_reported_payout_reversal',
        },
      });
      return 'recorded';
    });
  }

  async getRunLedger(tenantId: string, payrollRunId: string) {
    const entries = await this.ledgerRepository.find({
      where: { tenantId, payrollRunId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    if (!entries.length) {
      // Empty is a valid state for older runs. It is not evidence of available funds.
      return {
        payrollRunId,
        entries: [] as PayrollRunFundingLedgerEntry[],
        verifiedFundingByCurrency: {},
        fundingEvidenceComplete: false,
        retryAuthorization: 'blocked' as const,
        reason: 'No verified run-scoped funding ledger entries exist for this payroll run.',
      };
    }

    const verifiedFundingByCurrency = entries.reduce<Record<string, number>>((totals, entry) => {
      if (entry.eventType === PayrollFundingLedgerEventType.FUNDING_RECEIVED) {
        totals[entry.currency] =
          Math.round(((totals[entry.currency] ?? 0) + Number(entry.amount)) * 100) / 100;
      }
      return totals;
    }, {});

    const confirmedPayoutDebitsByCurrency = entries.reduce<Record<string, number>>(
      (totals, entry) => {
        if (
          entry.eventType === PayrollFundingLedgerEventType.PAYOUT_CONFIRMED ||
          entry.eventType === PayrollFundingLedgerEventType.PAYOUT_REVERSED
        ) {
          const signed =
            entry.eventType === PayrollFundingLedgerEventType.PAYOUT_REVERSED
              ? -Number(entry.amount)
              : Number(entry.amount);
          totals[entry.currency] = Math.round(((totals[entry.currency] ?? 0) + signed) * 100) / 100;
        }
        return totals;
      },
      {},
    );

    // Funding credits alone are never enough to authorize a retry. Payout debits and unresolved
    // provider statuses must be reconciled before available funds can be safely calculated.
    return {
      payrollRunId,
      entries,
      verifiedFundingByCurrency,
      confirmedPayoutDebitsByCurrency,
      fundingEvidenceComplete: false,
      retryAuthorization: 'blocked' as const,
      reason:
        'Verified funding is recorded, but payout debits and outstanding reservations must be reconciled before the ledger can authorize spending.',
    };
  }
}
