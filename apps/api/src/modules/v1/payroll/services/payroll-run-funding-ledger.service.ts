import { createHash } from 'node:crypto';
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

function reservationReleaseIdempotencyKey(
  reservationKey: string,
  outcome: 'failure' | 'payout',
  provider: string,
  providerReference: string,
): string {
  const fingerprint = createHash('sha256')
    .update(`${reservationKey}:${outcome}:${provider}:${providerReference}`)
    .digest('hex');
  return `reservation-release:${fingerprint}`;
}

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
    const verifiedStatus =
      typeof input.evidence?.verifiedStatus === 'string'
        ? input.evidence.verifiedStatus.trim().toUpperCase()
        : '';
    const terminalSuccessStatuses = new Set([
      'SUCCESS',
      'SUCCESSFUL',
      'SUCCEEDED',
      'COMPLETED',
      'PAID',
      'SETTLED',
      'ACCEPTED',
    ]);
    if (!terminalSuccessStatuses.has(verifiedStatus)) {
      throw new Error('A payout debit requires provider-confirmed terminal success evidence');
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
        const releaseKey = reservationReleaseIdempotencyKey(
          reservationKey,
          'payout',
          input.provider,
          providerReference,
        );
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

      const releaseIdempotencyKey = reservationReleaseIdempotencyKey(
        reservationKey,
        'failure',
        input.provider,
        providerReference,
      );
      const existingRelease = await ledger.findOne({
        where: { idempotencyKey: releaseIdempotencyKey },
      });
      if (existingRelease) return;

      const entries = await ledger.find({
        where: { tenantId: input.tenantId, payrollRunId: input.payrollRunId },
      });
      // A confirmed debit wins over a late failure notification. Never restore reserved
      // funds after the provider has already confirmed that money left the source account.
      if (
        entries.some(
          (entry) =>
            entry.eventType === PayrollFundingLedgerEventType.PAYOUT_CONFIRMED &&
            entry.payrollItemId === input.payrollItemId,
        )
      ) {
        return;
      }
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
  /**
   * Release every still-active reservation for an item after a provider-confirmed terminal
   * failure. This is safe to call repeatedly during retry preflight and reconciliation.
   */
  async releaseFailedPayoutReservationsForItem(input: {
    tenantId: string;
    payrollRunId: string;
    payrollItemId: string;
    provider: string;
    providerReference: string;
    evidence: Record<string, string | number | boolean | null>;
  }): Promise<number> {
    const providerReference = input.providerReference.trim();
    const verifiedStatus =
      typeof input.evidence.verifiedStatus === 'string'
        ? input.evidence.verifiedStatus.trim().toUpperCase()
        : '';
    const terminalFailureStatuses = new Set(['FAILED', 'REJECTED', 'CANCELLED', 'CANCELED']);
    if (!providerReference || !terminalFailureStatuses.has(verifiedStatus)) {
      throw new Error('Reservations require provider-confirmed terminal failure evidence');
    }

    return this.ledgerRepository.manager.transaction(async (manager) => {
      const run = await manager.getRepository(PayrollRun).findOne({
        where: { id: input.payrollRunId, tenantId: input.tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!run) throw new Error('Payroll run not found for reservation release');

      const ledger = manager.getRepository(PayrollRunFundingLedgerEntry);
      const entries = await ledger.find({
        where: { tenantId: input.tenantId, payrollRunId: input.payrollRunId },
      });
      if (
        entries.some(
          (entry) =>
            entry.eventType === PayrollFundingLedgerEventType.PAYOUT_CONFIRMED &&
            entry.payrollItemId === input.payrollItemId,
        )
      ) {
        return 0;
      }

      const releasedKeys = new Set(
        entries
          .filter((entry) => entry.eventType === PayrollFundingLedgerEventType.RESERVATION_RELEASED)
          .map((entry) => entry.evidence?.releasedReservationKey)
          .filter((key): key is string => typeof key === 'string'),
      );
      let releasedCount = 0;
      for (const reservation of entries) {
        if (
          reservation.eventType !== PayrollFundingLedgerEventType.PAYOUT_RESERVED ||
          reservation.payrollItemId !== input.payrollItemId
        ) {
          continue;
        }
        const reservationKey =
          typeof reservation.evidence?.reservationKey === 'string'
            ? reservation.evidence.reservationKey
            : '';
        if (!reservationKey || releasedKeys.has(reservationKey)) continue;

        const releaseIdempotencyKey = reservationReleaseIdempotencyKey(
          reservationKey,
          'failure',
          input.provider,
          providerReference,
        );
        const existingRelease = await ledger.findOne({
          where: { idempotencyKey: releaseIdempotencyKey },
        });
        if (existingRelease) {
          releasedKeys.add(reservationKey);
          continue;
        }

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
          performedById: null,
          approvedById: null,
          evidence: {
            ...input.evidence,
            verifiedStatus,
            releasedReservationKey: reservationKey,
            reason: 'provider_confirmed_terminal_failure',
          },
        });
        releasedKeys.add(reservationKey);
        releasedCount += 1;
      }
      return releasedCount;
    });
  }

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
      if (run.status !== PayrollStatus.APPROVED && run.status !== PayrollStatus.PROCESSING) {
        throw new Error('Funding can only be reserved for an approved or processing payroll run');
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

  /**
   * Atomically reserve funding for every selected retry item and reset those items for retry.
   * The database transaction prevents a partial reservation set or a retry-ready item without
   * its corresponding funding reservation.
   */
  /**
   * Release a reservation when local readiness validation proves that no provider submission
   * was made for this item. This path is intentionally separate from provider-failure release.
   */
  async releaseUnsubmittedPayoutReservation(input: {
    tenantId: string;
    payrollRunId: string;
    payrollItemId: string;
    reservationKey: string;
    evidence: Record<string, string | number | boolean | null>;
  }): Promise<boolean> {
    if (input.evidence.submissionAttempted !== false) {
      throw new Error('An unsubmitted reservation release requires proof no payout was submitted');
    }
    return this.ledgerRepository.manager.transaction(async (manager) => {
      const run = await manager.getRepository(PayrollRun).findOne({
        where: { id: input.payrollRunId, tenantId: input.tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!run) throw new Error('Payroll run not found for reservation release');
      const item = await manager.getRepository(PayrollItem).findOne({
        where: { id: input.payrollItemId, payrollRunId: input.payrollRunId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item || item.status !== PayrollItemStatus.FAILED) {
        throw new Error(
          'Only a locally rejected failed item can release an unsubmitted reservation',
        );
      }
      if (
        item.metadata?.payoutSubmissionPending === true ||
        item.transactionId ||
        item.paymentProvider
      ) {
        throw new Error('Cannot release a reservation when provider submission may have occurred');
      }
      const ledger = manager.getRepository(PayrollRunFundingLedgerEntry);
      const reservationIdempotencyKey = `reservation:${input.payrollRunId}:${input.reservationKey}`;
      const reservation = await ledger.findOne({
        where: { idempotencyKey: reservationIdempotencyKey },
      });
      if (
        !reservation ||
        reservation.tenantId !== input.tenantId ||
        reservation.payrollRunId !== input.payrollRunId ||
        reservation.payrollItemId !== input.payrollItemId
      ) {
        throw new Error('Matching run-scoped reservation was not found');
      }
      const entries = await ledger.find({
        where: { tenantId: input.tenantId, payrollRunId: input.payrollRunId },
      });
      if (
        entries.some(
          (entry) =>
            entry.eventType === PayrollFundingLedgerEventType.PAYOUT_CONFIRMED &&
            entry.payrollItemId === input.payrollItemId,
        )
      ) {
        return false;
      }
      const alreadyReleased = entries.some(
        (entry) =>
          entry.eventType === PayrollFundingLedgerEventType.RESERVATION_RELEASED &&
          entry.evidence?.releasedReservationKey === input.reservationKey,
      );
      if (alreadyReleased) return false;
      await ledger.insert({
        tenantId: input.tenantId,
        payrollRunId: input.payrollRunId,
        payrollItemId: input.payrollItemId,
        eventType: PayrollFundingLedgerEventType.RESERVATION_RELEASED,
        amount: reservation.amount,
        currency: reservation.currency,
        provider: reservation.provider,
        providerReference: null,
        idempotencyKey: reservationReleaseIdempotencyKey(
          input.reservationKey,
          'failure',
          reservation.provider,
          'local-not-submitted',
        ),
        performedById: null,
        approvedById: null,
        evidence: {
          ...input.evidence,
          releasedReservationKey: input.reservationKey,
          reason: 'local_validation_prevented_submission',
          submissionAttempted: false,
        },
      });
      return true;
    });
  }

  async reserveFailedPayoutsForRetry(input: {
    tenantId: string;
    payrollRunId: string;
    provider: string;
    performedById: string;
    evidence: Record<string, string | number | boolean | null>;
    reservations: Array<{
      payrollItemId: string;
      amount: number;
      currency: string;
      reservationKey: string;
    }>;
  }): Promise<void> {
    if (input.reservations.length === 0) {
      throw new Error('At least one payout reservation is required');
    }
    const normalized = input.reservations.map((reservation) => ({
      ...reservation,
      amount: Math.round(reservation.amount * 100) / 100,
      currency: reservation.currency.trim().toUpperCase(),
      reservationKey: reservation.reservationKey.trim(),
    }));
    if (
      normalized.some(
        (reservation) =>
          !Number.isFinite(reservation.amount) ||
          reservation.amount <= 0 ||
          !reservation.currency ||
          !reservation.reservationKey ||
          !reservation.payrollItemId,
      ) ||
      new Set(normalized.map((reservation) => reservation.payrollItemId)).size !==
        normalized.length ||
      new Set(normalized.map((reservation) => reservation.reservationKey)).size !==
        normalized.length
    ) {
      throw new Error('Retry reservations must have unique items and valid positive allocations');
    }
    const currencies = new Set(normalized.map((reservation) => reservation.currency));
    if (currencies.size !== 1) {
      throw new Error('Retry reservations must use one source funding currency');
    }
    const currency = normalized[0].currency;

    await this.ledgerRepository.manager.transaction(async (manager) => {
      const run = await manager.getRepository(PayrollRun).findOne({
        where: { id: input.payrollRunId, tenantId: input.tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!run) throw new Error('Payroll run not found for funding reservation');
      if (run.status !== PayrollStatus.APPROVED && run.status !== PayrollStatus.PROCESSING) {
        throw new Error('Funding can only be reserved for an approved or processing payroll run');
      }

      const itemRepository = manager.getRepository(PayrollItem);
      const items = await itemRepository.find({
        where: { payrollRunId: input.payrollRunId },
        lock: { mode: 'pessimistic_write' },
      });
      const selectedIds = new Set(normalized.map((reservation) => reservation.payrollItemId));
      const selectedItems = normalized.map((reservation) => {
        const item = items.find((candidate) => candidate.id === reservation.payrollItemId);
        if (!item || item.status !== PayrollItemStatus.FAILED) {
          throw new Error('Only failed items in this payroll run can be reserved for retry');
        }
        if (item.metadata?.payoutSubmissionPending === true) {
          throw new Error('Cannot reserve a payout while its submission outcome is unknown');
        }
        return { item, reservation };
      });
      if (
        items.some(
          (item) =>
            !selectedIds.has(item.id) &&
            (item.status === PayrollItemStatus.PENDING ||
              item.status === PayrollItemStatus.PROCESSING ||
              item.metadata?.payoutSubmissionPending === true),
        )
      ) {
        throw new Error('Cannot reserve funds while any other payout outcome remains unresolved');
      }

      const ledger = manager.getRepository(PayrollRunFundingLedgerEntry);
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

      let newReservationTotal = 0;
      for (const { item, reservation } of selectedItems) {
        const idempotencyKey = `reservation:${input.payrollRunId}:${reservation.reservationKey}`;
        const existing = await ledger.findOne({ where: { idempotencyKey } });
        if (existing) {
          if (
            existing.tenantId !== input.tenantId ||
            existing.payrollRunId !== input.payrollRunId ||
            existing.payrollItemId !== item.id ||
            Number(existing.amount) !== reservation.amount ||
            existing.currency !== reservation.currency
          ) {
            throw new Error('Reservation key was already used for a different payout');
          }
          throw new Error(
            'A reservation already exists for this retry attempt; reconcile it before retrying',
          );
        }
        newReservationTotal += reservation.amount;
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
      if (available < newReservationTotal) {
        throw new Error(
          `Insufficient verified run-scoped funds: ${available} ${currency} available`,
        );
      }

      for (const { item, reservation } of selectedItems) {
        await ledger.insert({
          tenantId: input.tenantId,
          payrollRunId: input.payrollRunId,
          payrollItemId: item.id,
          eventType: PayrollFundingLedgerEventType.PAYOUT_RESERVED,
          amount: reservation.amount.toFixed(2),
          currency: reservation.currency,
          provider: input.provider,
          providerReference: null,
          idempotencyKey: `reservation:${input.payrollRunId}:${reservation.reservationKey}`,
          performedById: input.performedById,
          approvedById: null,
          evidence: {
            ...input.evidence,
            reservationKey: reservation.reservationKey,
          },
        });
        const priorRetry =
          typeof item.metadata?.payoutRetryCount === 'number' ? item.metadata.payoutRetryCount : 0;
        item.status = PayrollItemStatus.PENDING;
        item.failureReason = null;
        item.transactionId = null;
        item.paymentProvider = null;
        item.paidAt = null;
        item.metadata = {
          ...(item.metadata ?? {}),
          payoutRetryCount: priorRetry + 1,
          retryFundingMaxSourceAmount: reservation.amount,
          retryFundingSourceCurrency: reservation.currency,
        };
        await itemRepository.save(item);
      }
    });
  }

  async recordRetryShortfallApproval(input: {
    tenantId: string;
    payrollRunId: string;
    selectedItemIds: string[];
    amount: number;
    currency: string;
    approvedById: string;
    provider: string;
    approvalReference: string;
    evidence?: Record<string, string | number | boolean | null>;
  }): Promise<void> {
    const amount = Math.round(input.amount * 100) / 100;
    const currency = input.currency.trim().toUpperCase();
    const selectedItemIds = [...new Set(input.selectedItemIds)].sort();
    const approvalReference = input.approvalReference.trim();
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !currency ||
      !approvalReference ||
      !input.approvedById ||
      input.provider !== 'BACHS' ||
      selectedItemIds.length === 0
    ) {
      throw new Error(
        'Retry shortfall approval requires selected items, a positive amount, currency, and approver',
      );
    }

    await this.ledgerRepository.manager.transaction(async (manager) => {
      const run = await manager.getRepository(PayrollRun).findOne({
        where: { id: input.payrollRunId, tenantId: input.tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!run) throw new Error('Payroll run not found for retry shortfall approval');
      if (run.status !== PayrollStatus.APPROVED && run.status !== PayrollStatus.PROCESSING) {
        throw new Error('Retry shortfall can only be approved for an approved or processing run');
      }

      const items = await manager.getRepository(PayrollItem).find({
        where: { payrollRunId: input.payrollRunId },
        lock: { mode: 'pessimistic_write' },
      });
      const selected = items.filter((item) => selectedItemIds.includes(item.id));
      if (
        selected.length !== selectedItemIds.length ||
        selected.some((item) => item.status !== PayrollItemStatus.FAILED)
      ) {
        throw new Error('Retry shortfall approval is limited to failed items in this payroll run');
      }

      const idempotencyKey = `shortfall-approval:${input.payrollRunId}:${approvalReference}`;
      const ledger = manager.getRepository(PayrollRunFundingLedgerEntry);
      const existing = await ledger.findOne({ where: { idempotencyKey } });
      if (existing) {
        if (
          existing.tenantId !== input.tenantId ||
          existing.payrollRunId !== input.payrollRunId ||
          Number(existing.amount) !== amount ||
          existing.currency !== currency ||
          existing.approvedById !== input.approvedById ||
          existing.evidence?.selectedItemIds !== selectedItemIds.join(',')
        ) {
          throw new Error('Retry shortfall approval reference was reused with different details');
        }
        return;
      }

      await ledger.insert({
        tenantId: input.tenantId,
        payrollRunId: input.payrollRunId,
        payrollItemId: null,
        eventType: PayrollFundingLedgerEventType.SHORTFALL_APPROVED,
        amount: amount.toFixed(2),
        currency,
        provider: input.provider,
        providerReference: approvalReference,
        idempotencyKey,
        performedById: input.approvedById,
        approvedById: input.approvedById,
        evidence: {
          ...input.evidence,
          selectedItemIds: selectedItemIds.join(','),
          approvalStatus: 'approved',
        },
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
