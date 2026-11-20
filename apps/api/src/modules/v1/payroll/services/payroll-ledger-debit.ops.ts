import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import { isPayoutSuccessStatus } from 'src/common/utils/payout-status.util';
import { Repository } from 'typeorm';

import { PayrollItem } from '../entities/payroll-item.entity';
import {
  PayrollFundingLedgerEventType,
  PayrollRunFundingLedgerEntry,
} from '../entities/payroll-run-funding-ledger-entry.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { reservationReleaseIdempotencyKey } from './payroll-run-funding-ledger.shared';

export class LedgerDebitOps {
  constructor(private readonly ledgerRepository: Repository<PayrollRunFundingLedgerEntry>) {}

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
    if (!isPayoutSuccessStatus(verifiedStatus)) {
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
          } else if (entry.eventType === PayrollFundingLedgerEventType.PAYOUT_REVERSED) {
            state.debited -= value;
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
}
