import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import { resolvePaymentProvider } from 'src/common/utils/resolve-payment-provider.util';

import { BILLING_AMOUNT_TOLERANCE } from '../../subscriptions/constants/billing.constants';
import { normalizeWebhookAmount } from '../../subscriptions/utils/per-seat-pricing.util';
import { PayrollRun } from '../entities/payroll-run.entity';
import { type PayrollFloatOrderRefProvider } from '../utils/payroll-float-order-ref.util';
import { readFloatTopupMeta } from '../utils/payroll-funding-meta.util';
import { SUCCESSFUL_CHECKOUT_STATUSES } from '../utils/payroll-funding.constants';
import { PayrollAttemptHistoryService } from './payroll-attempt-history.service';
import { PayrollFloatTopupRunService } from './payroll-float-topup-run.service';
import { PayrollPaymentOrchestrator } from './payroll-payment-orchestrator';
import { PayrollRunFundingLedgerService } from './payroll-run-funding-ledger.service';

@Injectable()
export class PayrollFloatTopupCompletionService {
  private readonly logger = new Logger(PayrollFloatTopupCompletionService.name);

  constructor(
    private readonly fundingLedger: PayrollRunFundingLedgerService,
    private readonly paymentFactory: PaymentProviderFactoryService,
    private readonly paymentOrchestrator: PayrollPaymentOrchestrator,
    private readonly floatTopupRun: PayrollFloatTopupRunService,
    private readonly attemptHistory: PayrollAttemptHistoryService,
  ) {}

  async completeFloatTopup(input: {
    tenantId: string;
    orderReference: string;
    amount?: number;
    initiatedByMemberId?: string;
    payrollRunId?: string;
  }): Promise<{ received: boolean; paid: boolean }> {
    const { run, attempt } = await this.floatTopupRun.findRunForTopup(input);
    if (!run) {
      this.logger.warn(`Payroll float top-up ignored: run not found for ${input.orderReference}`);
      return { received: true, paid: false };
    }

    const meta = readFloatTopupMeta(run);
    const trackedReferences = [meta.orderReference, ...(meta.references ?? [])].filter(
      (reference): reference is string => Boolean(reference),
    );
    if (attempt?.purpose !== 'run_funding' && !trackedReferences.includes(input.orderReference)) {
      this.logger.warn(
        `Payroll float top-up rejected: checkout reference mismatch for ${input.orderReference}`,
      );
      return { received: true, paid: false };
    }
    if (attempt?.status === 'confirmed' && meta.status !== 'completed') {
      return this.finishConfirmedFunding(run.id, run.tenantId, input, meta, attempt.provider);
    }
    if (attempt?.status === 'confirmed' || (!attempt && meta.status === 'completed')) {
      if (input.orderReference !== meta.orderReference) {
        this.logger.warn(
          `Payroll float top-up needs support: a superseded checkout (${input.orderReference}) was paid after run ${run.id} was already funded`,
        );
      }
      return { received: true, paid: run.payoutMode !== 'scheduled' };
    }

    const provider =
      (attempt?.provider as PaymentProvider | undefined) ??
      (meta.provider as PaymentProvider | undefined) ??
      (resolvePaymentProvider(run.baseCurrency) as PayrollFloatOrderRefProvider);
    const adapter = this.paymentFactory.resolveCheckoutAdapter(provider);
    if (!adapter?.isConfigured()) {
      this.logger.warn(
        `Payroll float top-up rejected: checkout adapter unavailable for ${input.orderReference}`,
      );
      return { received: true, paid: false };
    }

    const verified = await adapter.verifyCheckout({
      orderReference: input.orderReference,
    });
    if (!verified) {
      this.logger.warn(
        `Payroll float top-up rejected: verification missing for ${input.orderReference}`,
      );
      return { received: true, paid: false };
    }

    const status = verified.status.toLowerCase();
    if (!SUCCESSFUL_CHECKOUT_STATUSES.has(status)) {
      this.logger.warn(
        `Payroll float top-up not successful yet for ${input.orderReference}: ${verified.status}`,
      );
      return { received: true, paid: false };
    }

    const expected = Number(attempt?.checkoutAmount ?? meta.shortfall);
    // The webhook payload is only a notification. Never use its amount as proof of payment:
    // only the provider's server-to-server verification response may fund a payroll run.
    const verifiedAmount = Number(verified.amount);
    if (
      !Number.isFinite(verifiedAmount) ||
      verifiedAmount <= 0 ||
      !Number.isFinite(expected) ||
      expected <= 0
    ) {
      this.logger.warn(
        `Payroll float top-up missing a valid verified amount or expected amount for ${input.orderReference}`,
      );
      return { received: true, paid: false };
    }
    const verifiedCurrency =
      typeof verified.currency === 'string' ? verified.currency.toUpperCase() : undefined;
    const expectedCurrency = (
      attempt?.currency ||
      meta.fundingCurrency ||
      run.baseCurrency
    ).toUpperCase();
    if (verifiedCurrency && verifiedCurrency !== expectedCurrency) {
      this.logger.warn(
        `Payroll float top-up currency mismatch for ${input.orderReference}: expected ${expectedCurrency}, got ${verifiedCurrency}`,
      );
      return { received: true, paid: false };
    }
    const paidAmount = normalizeWebhookAmount(verifiedAmount, expected, expectedCurrency);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      this.logger.warn(`Payroll float top-up invalid verified amount for ${input.orderReference}`);
      return { received: true, paid: false };
    }
    if (expected > 0 && paidAmount + BILLING_AMOUNT_TOLERANCE < expected) {
      this.logger.warn(
        `Payroll float top-up underpaid for ${input.orderReference}: expected ${expected}, got ${paidAmount}`,
      );
      return { received: true, paid: false };
    }
    if (expected > 0 && paidAmount > expected + BILLING_AMOUNT_TOLERANCE) {
      this.logger.warn(
        `Payroll float top-up overpaid for ${input.orderReference}: expected ${expected}, got ${paidAmount}`,
      );
    }

    // Credit, attempt confirmation and run claim commit together. Separate commits could strand
    // a run: a confirmed attempt with an unclaimed run makes every webhook retry return early.
    const claimed = await this.floatTopupRun.transaction(async (manager) => {
      await this.fundingLedger.recordVerifiedFunding(
        {
          tenantId: run.tenantId,
          payrollRunId: run.id,
          amount: paidAmount,
          currency: expectedCurrency,
          provider,
          providerReference: input.orderReference,
          performedById: input.initiatedByMemberId,
          evidence: {
            verifiedStatus: verified.status,
            verifiedAmount,
            expectedAmount: expected,
            currencyReportedByProvider: verifiedCurrency ?? null,
          },
        },
        manager,
      );
      await this.attemptHistory.transitionFundingAttempt(
        {
          tenantId: run.tenantId,
          payrollRunId: run.id,
          provider,
          orderReference: input.orderReference,
          status: 'confirmed',
          providerReference: input.orderReference,
        },
        manager,
      );
      return this.floatTopupRun.claimFloatTopupCompleted(
        {
          runId: run.id,
          tenantId: run.tenantId,
          orderReference: input.orderReference,
          shortfall: meta.shortfall,
          provider,
          fundingCurrency: meta.fundingCurrency,
        },
        manager,
      );
    });
    return this.autoPayAfterClaim(claimed, run.payoutMode, input.initiatedByMemberId);
  }

  /**
   * An attempt confirmed by the earlier split-commit flow whose run was never marked completed.
   * The provider verification already happened, so only the run claim is replayed.
   */
  private async finishConfirmedFunding(
    runId: string,
    tenantId: string,
    input: { orderReference: string; initiatedByMemberId?: string },
    meta: ReturnType<typeof readFloatTopupMeta>,
    provider: string,
  ): Promise<{ received: boolean; paid: boolean }> {
    const claimed = await this.floatTopupRun.claimFloatTopupCompleted({
      runId,
      tenantId,
      orderReference: input.orderReference,
      shortfall: meta.shortfall,
      provider,
      fundingCurrency: meta.fundingCurrency,
    });
    return this.autoPayAfterClaim(claimed, undefined, input.initiatedByMemberId);
  }

  private async autoPayAfterClaim(
    claimed: PayrollRun | null,
    previousPayoutMode: string | null | undefined,
    initiatedByMemberId?: string,
  ): Promise<{ received: boolean; paid: boolean }> {
    if (!claimed) {
      // Duplicate webhook delivery must not imply that a scheduled run was paid early.
      return { received: true, paid: previousPayoutMode !== 'scheduled' };
    }

    if (claimed.payoutMode === 'scheduled') {
      return { received: true, paid: false };
    }

    if (claimed.status !== PayrollStatus.APPROVED) {
      this.logger.warn(
        `Payroll float top-up completed but run ${claimed.id} status is ${claimed.status}; skipping auto-pay`,
      );
      return { received: true, paid: false };
    }

    const performedById = initiatedByMemberId || claimed.createdById;
    try {
      await this.paymentOrchestrator.payNowPayroll(claimed.id, claimed.tenantId, {
        tenantId: claimed.tenantId,
        payrollRunId: claimed.id,
        performedById,
      });
      return { received: true, paid: true };
    } catch (error) {
      this.logger.error(
        `Auto pay-now after float top-up failed for run ${claimed.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { received: true, paid: false };
    }
  }
}
