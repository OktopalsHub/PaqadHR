import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import { Repository } from 'typeorm';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import {
  PayrollFundingLedgerEventType,
  PayrollRunFundingLedgerEntry,
} from '../entities/payroll-run-funding-ledger-entry.entity';

export interface VerifiedPayrollFundingInput {
  tenantId: string;
  payrollRunId: string;
  amount: number;
  currency: string;
  provider: string;
  providerReference: string;
  performedById?: string | null;
  evidence?: Record<string, string | number | boolean | null>;
}

@Injectable()
export class PayrollRunFundingLedgerService {
  constructor(
    @InjectRepository(PayrollRunFundingLedgerEntry)
    private readonly ledgerRepository: Repository<PayrollRunFundingLedgerEntry>,
  ) {}

  /**
   * Append a provider-verified funding event. The provider reference is the idempotency key:
   * webhook retries cannot create additional funding credit for the same checkout.
   */
  async recordVerifiedFunding(input: VerifiedPayrollFundingInput): Promise<void> {
    const amount = Math.round(input.amount * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Verified payroll funding amount must be positive');
    }
    const currency = input.currency.trim().toUpperCase();
    const providerReference = input.providerReference.trim();
    if (!currency || !providerReference) {
      throw new Error('Verified payroll funding requires currency and provider reference');
    }

    const existing = await this.ledgerRepository.findOne({
      where: { idempotencyKey: `funding:${providerReference}` },
    });
    if (existing) {
      if (
        existing.tenantId !== input.tenantId ||
        existing.payrollRunId !== input.payrollRunId ||
        Number(existing.amount) !== amount ||
        existing.currency !== currency
      ) {
        throw new Error(
          'Funding reference was already allocated to a different payroll transaction',
        );
      }
      return;
    }

    try {
      await this.ledgerRepository.insert({
        tenantId: input.tenantId,
        payrollRunId: input.payrollRunId,
        eventType: PayrollFundingLedgerEventType.FUNDING_RECEIVED,
        amount: amount.toFixed(2),
        currency,
        provider: input.provider,
        providerReference,
        idempotencyKey: `funding:${providerReference}`,
        performedById: input.performedById ?? null,
        approvedById: null,
        evidence: input.evidence ?? null,
      });
    } catch (error) {
      // A concurrent delivery may pass the initial lookup before the other insert commits.
      // Re-read the unique key and accept only an exact match; all other database errors escape.
      const raced = await this.ledgerRepository.findOne({
        where: { idempotencyKey: `funding:${providerReference}` },
      });
      if (
        !raced ||
        raced.tenantId !== input.tenantId ||
        raced.payrollRunId !== input.payrollRunId ||
        Number(raced.amount) !== amount ||
        raced.currency !== currency
      ) {
        throw error;
      }
    }
  }

  /**
   * Record a debit only when the provider reports the amount removed from its source float.
   * Destination salary amounts are not a safe substitute for cross-currency Bachs debits.
   */
  async recordConfirmedPayoutDebit(input: {
    tenantId: string;
    payrollRunId: string;
    payrollItemId: string;
    amount: number;
    currency: string;
    provider: string;
    providerReference: string;
    evidence?: Record<string, string | number | boolean | null>;
  }): Promise<void> {
    const amount = Math.round(input.amount * 100) / 100;
    const currency = input.currency.trim().toUpperCase();
    const providerReference = input.providerReference.trim();
    if (!Number.isFinite(amount) || amount <= 0 || !currency || !providerReference) {
      throw new Error(
        'A confirmed payout debit requires a positive amount, currency, and provider reference',
      );
    }

    const idempotencyKey = `payout:${input.provider}:${providerReference}`;
    await this.ledgerRepository.manager.transaction(async (manager) => {
      const run = await manager.getRepository(PayrollRun).findOne({
        where: { id: input.payrollRunId, tenantId: input.tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!run) throw new Error('Payroll run not found for confirmed payout debit');

      const ledger = manager.getRepository(PayrollRunFundingLedgerEntry);
      const existing = await ledger.findOne({ where: { idempotencyKey } });
      if (existing) {
        if (
          existing.tenantId !== input.tenantId ||
          existing.payrollRunId !== input.payrollRunId ||
          existing.payrollItemId !== input.payrollItemId ||
          Number(existing.amount) !== amount ||
          existing.currency !== currency
        ) {
          throw new Error(
            'Payout debit reference was already allocated to a different payroll transaction',
          );
        }
      } else {
        await ledger.insert({
          tenantId: input.tenantId,
          payrollRunId: input.payrollRunId,
          payrollItemId: input.payrollItemId,
          eventType: PayrollFundingLedgerEventType.PAYOUT_CONFIRMED,
          amount: amount.toFixed(2),
          currency,
          provider: input.provider,
          providerReference,
          idempotencyKey,
          performedById: null,
          approvedById: null,
          evidence: input.evidence ?? null,
        });
      }

      // A confirmed debit consumes any active reservation for this item in the same
      // transaction. This prevents the balance from counting both the reservation and
      // the final debit. Unknown/pending outcomes never reach this method.
      const entries = await ledger.find({
        where: { tenantId: input.tenantId, payrollRunId: input.payrollRunId },
      });
      const reservations = new Map<string, PayrollRunFundingLedgerEntry>();
      const released = new Set<string>();
      for (const entry of entries) {
        if (entry.payrollItemId !== input.payrollItemId) continue;
        const evidence = entry.evidence;
        const reservationKey =
          evidence && typeof evidence.reservationKey === 'string'
            ? evidence.reservationKey
            : undefined;
        const releasedReservationKey =
          evidence && typeof evidence.releasedReservationKey === 'string'
            ? evidence.releasedReservationKey
            : undefined;
        if (entry.eventType === PayrollFundingLedgerEventType.PAYOUT_RESERVED && reservationKey) {
          reservations.set(reservationKey, entry);
        }
        if (
          entry.eventType === PayrollFundingLedgerEventType.RESERVATION_RELEASED &&
          releasedReservationKey
        ) {
          released.add(releasedReservationKey);
        }
      }

      for (const [reservationKey, reservation] of reservations) {
        if (released.has(reservationKey)) continue;
        const releaseKey = `reservation-release:${reservationKey}:payout:${input.provider}:${providerReference}`;
        await ledger.insert({
          tenantId: input.tenantId,
          payrollRunId: input.payrollRunId,
          payrollItemId: input.payrollItemId,
          eventType: PayrollFundingLedgerEventType.RESERVATION_RELEASED,
          amount: reservation.amount,
          currency: reservation.currency,
          provider: input.provider,
          providerReference,
          idempotencyKey: releaseKey,
          performedById: null,
          approvedById: null,
          evidence: {
            releasedReservationKey: reservationKey,
            reason: 'provider_confirmed_payout_debit',
            verifiedStatus:
              typeof input.evidence?.verifiedStatus === 'string'
                ? input.evidence.verifiedStatus
                : null,
          },
        });
      }
    });
  }

  /**
   * Release a reservation only after the provider confirms a terminal failure.
   * Pending, unknown, and timeout outcomes are intentionally rejected.
   */
  async releaseFailedPayoutReservation(input: {
    tenantId: string;
    payrollRunId: string;
    payrollItemId: string;
    reservationKey: string;
    provider: string;
    providerReference: string;
    performedById?: string | null;
    evidence: Record<string, string | number | boolean | null>;
  }): Promise<void> {
    const reservationKey = input.reservationKey.trim();
    const providerReference = input.providerReference.trim();
    const verifiedStatus =
      typeof input.evidence.verifiedStatus === 'string'
        ? input.evidence.verifiedStatus.trim().toUpperCase()
        : '';
    const terminalFailureStatuses = new Set(['FAILED', 'REJECTED', 'CANCELLED', 'CANCELED']);
    if (!reservationKey || !providerReference || !terminalFailureStatuses.has(verifiedStatus)) {
      throw new Error(
        'A payout reservation can only be released with a provider-confirmed terminal failure',
      );
    }

    await this.ledgerRepository.manager.transaction(async (manager) => {
      const run = await manager.getRepository(PayrollRun).findOne({
        where: { id: input.payrollRunId, tenantId: input.tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!run) throw new Error('Payroll run not found for reservation release');

      const ledger = manager.getRepository(PayrollRunFundingLedgerEntry);
      const reservationIdempotencyKey = `reservation:${input.payrollRunId}:${reservationKey}`;
      const reservation = await ledger.findOne({
        where: { idempotencyKey: reservationIdempotencyKey },
      });
      if (
        !reservation ||
        reservation.tenantId !== input.tenantId ||
        reservation.payrollRunId !== input.payrollRunId ||
        reservation.payrollItemId !== input.payrollItemId ||
        reservation.eventType !== PayrollFundingLedgerEventType.PAYOUT_RESERVED
      ) {
        throw new Error('Matching payout reservation was not found');
      }

      const releaseIdempotencyKey = `reservation-release:${reservationKey}:failure:${input.provider}:${providerReference}`;
      const existingRelease = await ledger.findOne({
        where: { idempotencyKey: releaseIdempotencyKey },
      });
      if (existingRelease) return;

      const entries = await ledger.find({
        where: { tenantId: input.tenantId, payrollRunId: input.payrollRunId },
      });
      const alreadyReleased = entries.some(
        (entry) =>
          entry.eventType === PayrollFundingLedgerEventType.RESERVATION_RELEASED &&
          entry.payrollItemId === input.payrollItemId &&
          entry.evidence?.releasedReservationKey === reservationKey,
      );
      if (alreadyReleased) return;

      await ledger.insert({
        tenantId: input.tenantId,
        payrollRunId: input.payrollRunId,
        payrollItemId: input.payrollItemId,
        eventType: PayrollFundingLedgerEventType.RESERVATION_RELEASED,
        amount: reservation.amount,
        currency: reservation.currency,
        provider: input.provider,
        providerReference,
        idempotencyKey: releaseIdempotencyKey,
        performedById: input.performedById ?? null,
        approvedById: null,
        evidence: {
          ...input.evidence,
          verifiedStatus,
          releasedReservationKey: reservationKey,
          reason: 'provider_confirmed_terminal_failure',
        },
      });
    });
  }

  /**
   * Atomically reserve run-owned funds for one previously failed payout.
   *
   * This deliberately requires a fully settled run before reserving: any pending/processing
   * item or paid item without a provider-confirmed debit makes the run unreconciled. The run
   * row lock serializes concurrent reservations for the same run. This is a ledger primitive;
   * callers must still keep retry authorization disabled until the whole funding workflow is
   * reviewed and wired end-to-end.
   */
  async reserveFailedPayout(input: {
    tenantId: string;
    payrollRunId: string;
    payrollItemId: string;
    amount: number;
    currency: string;
    provider: string;
    reservationKey: string;
    performedById: string;
    evidence: Record<string, string | number | boolean | null>;
  }): Promise<void> {
    const amount = Math.round(input.amount * 100) / 100;
    const currency = input.currency.trim().toUpperCase();
    const reservationKey = input.reservationKey.trim();
    if (!Number.isFinite(amount) || amount <= 0 || !currency || !reservationKey) {
      throw new Error('A payout reservation requires a positive amount, currency, and key');
    }

    await this.ledgerRepository.manager.transaction(async (manager) => {
      const run = await manager.getRepository(PayrollRun).findOne({
        where: { id: input.payrollRunId, tenantId: input.tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!run) throw new Error('Payroll run not found for funding reservation');
      if (run.status !== PayrollStatus.APPROVED) {
        throw new Error('Funding can only be reserved for an approved payroll run');
      }

      const ledger = manager.getRepository(PayrollRunFundingLedgerEntry);
      const idempotencyKey = `reservation:${input.payrollRunId}:${reservationKey}`;
      const existing = await ledger.findOne({ where: { idempotencyKey } });
      if (existing) {
        if (
          existing.tenantId !== input.tenantId ||
          existing.payrollRunId !== input.payrollRunId ||
          existing.payrollItemId !== input.payrollItemId ||
          Number(existing.amount) !== amount ||
          existing.currency !== currency
        ) {
          throw new Error('Reservation key was already used for a different payout');
        }
        return;
      }

      const items = await manager.getRepository(PayrollItem).find({
        where: { payrollRunId: input.payrollRunId },
        lock: { mode: 'pessimistic_write' },
      });
      const selected = items.find((item) => item.id === input.payrollItemId);
      if (!selected || selected.status !== PayrollItemStatus.FAILED) {
        throw new Error('Only a confirmed failed payout can be reserved for retry');
      }
      if (selected.metadata?.payoutSubmissionPending === true) {
        throw new Error('Cannot reserve a payout while its submission outcome is unknown');
      }
      if (
        items.some(
          (item) =>
            item.status === PayrollItemStatus.PENDING ||
            item.status === PayrollItemStatus.PROCESSING,
        )
      ) {
        throw new Error('Cannot reserve funds while any payout outcome remains unresolved');
      }

      const entries = await ledger.find({
        where: { tenantId: input.tenantId, payrollRunId: input.payrollRunId },
      });
      const paidItemIds = new Set(
        entries
          .filter((entry) => entry.eventType === PayrollFundingLedgerEventType.PAYOUT_CONFIRMED)
          .map((entry) => entry.payrollItemId)
          .filter((id): id is string => Boolean(id)),
      );
      if (
        items.some((item) => item.status === PayrollItemStatus.PAID && !paidItemIds.has(item.id))
      ) {
        throw new Error('Cannot reserve funds until every paid payout has a confirmed debit');
      }

      const totals = entries.reduce(
        (state, entry) => {
          if (entry.currency !== currency) return state;
          const value = Number(entry.amount);
          if (entry.eventType === PayrollFundingLedgerEventType.FUNDING_RECEIVED) {
            state.funded += value;
          } else if (entry.eventType === PayrollFundingLedgerEventType.PAYOUT_CONFIRMED) {
            state.debited += value;
          } else if (entry.eventType === PayrollFundingLedgerEventType.PAYOUT_RESERVED) {
            state.reserved += value;
          } else if (entry.eventType === PayrollFundingLedgerEventType.RESERVATION_RELEASED) {
            state.released += value;
          }
          return state;
        },
        { funded: 0, debited: 0, reserved: 0, released: 0 },
      );
      const available =
        Math.round((totals.funded - totals.debited - totals.reserved + totals.released) * 100) /
        100;
      if (available < amount) {
        throw new Error(
          `Insufficient verified run-scoped funds: ${available} ${currency} available`,
        );
      }

      await ledger.insert({
        tenantId: input.tenantId,
        payrollRunId: input.payrollRunId,
        payrollItemId: input.payrollItemId,
        eventType: PayrollFundingLedgerEventType.PAYOUT_RESERVED,
        amount: amount.toFixed(2),
        currency,
        provider: input.provider,
        providerReference: null,
        idempotencyKey,
        performedById: input.performedById,
        approvedById: null,
        evidence: { ...input.evidence, reservationKey },
      });
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
        entries: [],
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
        if (entry.eventType === PayrollFundingLedgerEventType.PAYOUT_CONFIRMED) {
          totals[entry.currency] =
            Math.round(((totals[entry.currency] ?? 0) + Number(entry.amount)) * 100) / 100;
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
