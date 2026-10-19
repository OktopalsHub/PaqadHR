import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    const existing = await this.ledgerRepository.findOne({ where: { idempotencyKey } });
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
      return;
    }

    try {
      await this.ledgerRepository.insert({
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
    } catch (error) {
      const raced = await this.ledgerRepository.findOne({ where: { idempotencyKey } });
      if (
        !raced ||
        raced.tenantId !== input.tenantId ||
        raced.payrollRunId !== input.payrollRunId ||
        raced.payrollItemId !== input.payrollItemId ||
        Number(raced.amount) !== amount ||
        raced.currency !== currency
      ) {
        throw error;
      }
    }
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
