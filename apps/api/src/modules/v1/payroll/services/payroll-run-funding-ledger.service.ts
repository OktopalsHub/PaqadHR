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
  evidence?: Record<string, unknown>;
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
        totals[entry.currency] = Math.round(((totals[entry.currency] ?? 0) + Number(entry.amount)) * 100) / 100;
      }
      return totals;
    }, {});

    // Funding credits alone are never enough to authorize a retry. Payout debits and unresolved
    // provider statuses must be reconciled before available funds can be safely calculated.
    return {
      payrollRunId,
      entries,
      verifiedFundingByCurrency,
      fundingEvidenceComplete: false,
      retryAuthorization: 'blocked' as const,
      reason:
        'Verified funding is recorded, but payout debits and outstanding reservations must be reconciled before the ledger can authorize spending.',
    };
  }
}
