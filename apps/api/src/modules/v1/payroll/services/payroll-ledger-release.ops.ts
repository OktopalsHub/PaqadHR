import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { Repository } from 'typeorm';

import { PayrollItem } from '../entities/payroll-item.entity';
import {
  PayrollFundingLedgerEventType,
  PayrollRunFundingLedgerEntry,
} from '../entities/payroll-run-funding-ledger-entry.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import {
  hasUnreversedConfirmedDebit,
  reservationReleaseIdempotencyKey,
} from './payroll-run-funding-ledger.shared';

export class LedgerReleaseOps {
  constructor(private readonly ledgerRepository: Repository<PayrollRunFundingLedgerEntry>) {}

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
      if (hasUnreversedConfirmedDebit(entries, input.payrollItemId)) {
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
      if (hasUnreversedConfirmedDebit(entries, input.payrollItemId)) {
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
      if (hasUnreversedConfirmedDebit(entries, input.payrollItemId)) {
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
}
