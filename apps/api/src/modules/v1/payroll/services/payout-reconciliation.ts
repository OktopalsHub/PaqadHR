import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import { FincraApiService } from 'src/common/services/fincra-api.service';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import { normalizePayoutStatus } from 'src/common/utils/normalize-payout-status.util';
import { paymentProviderLabel } from 'src/common/utils/resolve-payment-provider.util';
import { LessThan, Repository } from 'typeorm';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { updatePayrollItemScopedIfStatus } from '../repositories/payroll-item-write.util';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import {
  buildPayrollMerchantRef,
  parsePayrollMerchantRef,
} from '../utils/payroll-merchant-ref.util';
import type { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';
import type { PayrollRunFundingLedgerService } from './payroll-run-funding-ledger.service';

const PAYROLL_AMOUNT_TOLERANCE = 1;

/** How long a PROCESSING item with no provider transaction id may stay unqueried before
 * reconciliation declares it failed. Nothing was ever submitted for these, so the only
 * reason to wait is to let a slow provider error land first. */
const NULL_TRANSACTION_STUCK_GRACE_MS = 60 * 60 * 1000;

const SUCCESS_STATUSES = new Set([
  'SUCCESS',
  'SUCCESSFUL',
  'COMPLETED',
  'PAYMENT_SUCCESSFUL',
  'SUCCEEDED',
  'PAID',
  'SETTLED',
]);
const PENDING_STATUSES = new Set([
  'PENDING',
  'PENDING_BILLING',
  'PROCESSING',
  'IN_PROGRESS',
  'PENDING_AUTHORIZATION',
  'AWAITING_AUTHORIZATION',
  'AWAITING_PROCESSING',
]);
const FAILED_STATUSES = new Set([
  'FAILED',
  'REFUND',
  'REVERSED',
  'CANCELLED',
  'CANCELED',
  'REJECTED',
]);

@Injectable()
export class PayoutReconciliation {
  private readonly logger = new Logger(PayoutReconciliation.name);

  constructor(
    private readonly fincraApi: FincraApiService,
    private readonly factory: PaymentProviderFactoryService,
    private readonly payrollRunRepository: PayrollRunRepository,
    @InjectRepository(PayrollItem)
    private readonly payrollItemRepo: Repository<PayrollItem>,
    private readonly lifecycleNotify?: PayrollLifecycleNotifyService,
    private readonly fundingLedger?: PayrollRunFundingLedgerService,
  ) {}

  async resolveTenantId(payrollRunId: string): Promise<string | undefined> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId },
      select: ['tenantId'],
    });
    return run?.tenantId;
  }

  resolveStoredProvider(stored: string | null | undefined): PaymentProvider {
    const value = (stored ?? '').toLowerCase();
    if (value.includes('fincra')) return PaymentProvider.FINCRA;
    if (value.includes('bachs')) return PaymentProvider.BACHS;
    if (value.includes('noah') || value.includes('international') || value.includes('crypto'))
      return PaymentProvider.NOAH;
    if (value.includes('monnify')) return PaymentProvider.MONNIFY;
    return PaymentProvider.NOMBA;
  }

  async requeryStuckPayouts(): Promise<{ checked: number; updated: number }> {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);

    // Sweep tenant-by-tenant rather than selecting every PROCESSING row in the instance.
    // A bare status+updatedAt filter has no tenant predicate, so it reads (and can notify
    // about) payroll items belonging to any tenant on this instance — a cross-tenant data
    // exposure. Each tenant is resolved from its own runs, then queried with an explicit
    // tenant_id predicate so no item is ever loaded outside its owner.
    const tenantIds =
      await this.payrollRunRepository.findDistinctTenantIdsWithProcessingItems(cutoff);

    let updated = 0;
    let checked = 0;

    for (const tenantId of tenantIds) {
      const stuckItems = await this.payrollItemRepo.find({
        where: {
          status: PayrollItemStatus.PROCESSING,
          updatedAt: LessThan(cutoff),
          payrollRun: { tenantId },
        },
        // Load the relations the failure notification reads: without `employee` the email falls
        // back to a raw member UUID, and without `payrollRun` every item costs an extra
        // resolveTenantId round trip.
        relations: ['employee', 'payrollRun'],
        take: 50,
      });
      checked += stuckItems.length;

      for (const item of stuckItems) {
        const changed = await this.reconcileStuckItem(item, tenantId);
        if (changed) updated += 1;
      }
    }

    return { checked, updated };
  }

  /** Reconcile one stuck item inside its own tenant scope. Returns true when it transitioned. */
  private async reconcileStuckItem(item: PayrollItem, tenantId: string): Promise<boolean> {
    const reference = item.transactionId;
    if (!reference) {
      // No provider reference means no payout was ever submitted, so no status query and
      // no webhook can ever move this item. Left alone it traps the run in APPROVED
      // forever, so fail it once the grace window has passed.
      return this.failNullTransactionStuckItem(item);
    }

    const retryAttempt =
      typeof item.metadata?.payoutRetryCount === 'number' ? item.metadata.payoutRetryCount : 0;
    const merchantRef = buildPayrollMerchantRef(item.payrollRunId, item.id, retryAttempt);
    const provider = this.resolveStoredProvider(item.paymentProvider);
    const querier = this.factory.resolvePayoutQuerier(provider);

    let status: string | null = null;
    let amount: number | undefined;

    if (querier) {
      const result = await querier.queryStatus(reference, merchantRef);
      if (result) {
        status = result.status;
        amount = result.amount;
      }
    }

    if (!status) return false;

    if (
      provider === PaymentProvider.BACHS &&
      this.fundingLedger &&
      new Set(['FAILED', 'REJECTED', 'CANCELLED', 'CANCELED']).has(status.trim().toUpperCase())
    ) {
      await this.fundingLedger.releaseFailedPayoutReservationsForItem({
        tenantId,
        payrollRunId: item.payrollRunId,
        payrollItemId: item.id,
        provider: PaymentProvider.BACHS,
        providerReference: reference,
        evidence: {
          verifiedStatus: status.trim().toUpperCase(),
          merchantReference: merchantRef,
          verificationSource: 'provider_status_query',
        },
      });
    }

    const changed = await this.applyTransferStatus(
      merchantRef,
      status,
      reference,
      provider,
      tenantId,
      amount,
    );
    if (changed) {
      await this.reconcilePayrollRunStatus(item.payrollRunId, tenantId);
    }
    return changed;
  }

  /**
   * A PROCESSING item with no provider transaction id cannot be requeried, so after the
   * grace window we fail it so the run can leave APPROVED and the admin sees the rejection.
   *
   * "No transaction id" does NOT prove "never submitted": a provider can accept the payout
   * and lose the response. Such items are flagged with `payoutSubmissionPending`, and they
   * are left in PROCESSING on purpose — failing one makes it retryable, and the retry mints a
   * fresh merchant reference (and therefore a fresh idempotency key), which the provider
   * cannot dedupe. Waiting for the payout webhook is the only safe terminal signal.
   *
   * Returns true when the item transitioned.
   */
  private async failNullTransactionStuckItem(item: PayrollItem): Promise<boolean> {
    if (item.metadata?.payoutSubmissionPending === true) {
      this.logger.warn(
        `Payroll item ${item.id} has an unknown payout submission outcome; leaving it PROCESSING for webhook resolution`,
      );
      return false;
    }

    const graceCutoff = new Date(Date.now() - NULL_TRANSACTION_STUCK_GRACE_MS);
    if (!item.updatedAt || item.updatedAt >= graceCutoff) return false;

    const tenantId = item.payrollRun?.tenantId ?? (await this.resolveTenantId(item.payrollRunId));
    if (!tenantId) return false;

    const reason =
      item.failureReason?.trim() || 'Payout was never submitted to the payment provider';

    // Fail only if the row is still PROCESSING. The synchronous payout path can mark the item
    // FAILED (and notify) while this sweep is between its SELECT and this UPDATE, so an
    // unconditional write would send a second failure email for the same item.
    const failed = await updatePayrollItemScopedIfStatus(
      this.payrollItemRepo,
      item.id,
      tenantId,
      PayrollItemStatus.PROCESSING,
      {
        status: PayrollItemStatus.FAILED,
        failureReason: reason,
      },
    );
    if (!failed) {
      this.logger.warn(
        `Payroll item ${item.id} was already resolved before the reconciliation sweep could fail it`,
      );
      return false;
    }

    this.logger.warn(
      `Payroll item ${item.id} stuck in PROCESSING with no provider payout; failing it`,
    );

    item.status = PayrollItemStatus.FAILED;
    item.failureReason = reason;
    if (this.lifecycleNotify) {
      await this.lifecycleNotify.onItemFailed({
        tenantId,
        item,
        run: item.payrollRun,
        reason,
        auditContext: {
          tenantId,
          payrollRunId: item.payrollRunId,
          performedById: item.payrollRun?.createdById ?? item.memberId,
          memberId: item.memberId,
        },
      });
    }

    await this.reconcilePayrollRunStatus(item.payrollRunId, tenantId);
    return true;
  }

  async reconcileFailedItemBeforeRetry(item: PayrollItem, tenantId: string): Promise<boolean> {
    const provider = this.resolveStoredProvider(item.paymentProvider);
    const retryAttempt =
      typeof item.metadata?.payoutRetryCount === 'number' ? item.metadata.payoutRetryCount : 0;

    if (provider === PaymentProvider.FINCRA) {
      try {
        for (let attempt = 0; attempt <= retryAttempt; attempt++) {
          const merchantRef = buildPayrollMerchantRef(item.payrollRunId, item.id, attempt);
          const verified = await this.fincraApi.getPayoutStatus(merchantRef);
          if (!verified) continue;

          const status = verified.status.toUpperCase();
          if (SUCCESS_STATUSES.has(status) || PENDING_STATUSES.has(status)) {
            await this.applyTransferStatus(
              merchantRef,
              status,
              verified.reference ?? item.transactionId ?? merchantRef,
              PaymentProvider.FINCRA,
              tenantId,
              verified.amount,
            );
            return false;
          }
        }

        const latestRef = buildPayrollMerchantRef(item.payrollRunId, item.id, retryAttempt);
        const latest = await this.fincraApi.getPayoutStatus(latestRef);
        if (!latest) return true;
        return !FAILED_STATUSES.has(latest.status.toUpperCase());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new BadRequestException(
          `Cannot retry payroll item ${item.id}: Fincra status lookup failed (${message})`,
        );
      }
    }

    const merchantRef = buildPayrollMerchantRef(item.payrollRunId, item.id, retryAttempt);
    const reference = item.transactionId?.trim();
    // A retry mints a new merchant reference, so anything already submitted under the
    // previous one stays a live payout. Items whose submission outcome we never learned
    // must not be retried blind — that is how an employee gets paid twice.
    if (provider === PaymentProvider.BACHS && !reference) {
      throw new BadRequestException(
        `Cannot retry payroll item ${item.id}: Bachs has not provided a payout reference to verify a terminal failure.`,
      );
    }
    if (!reference && item.metadata?.payoutSubmissionPending === true) {
      throw new BadRequestException(
        `Cannot retry payroll item ${item.id}: its payout submission outcome is still unknown. ` +
          'Wait for the provider to confirm the payout before retrying.',
      );
    }
    if (!reference) return true;

    const querier = this.factory.resolvePayoutQuerier(provider);
    let status: string | null = null;
    let amount: number | undefined;

    if (querier) {
      const result = await querier.queryStatus(reference, merchantRef);
      if (result) {
        status = result.status;
        amount = result.amount;
      }
    }

    if (provider === PaymentProvider.BACHS) {
      const terminalFailureStatuses = new Set(['FAILED', 'REJECTED', 'CANCELLED', 'CANCELED']);
      const verifiedStatus = status?.trim().toUpperCase();
      if (!verifiedStatus) {
        throw new BadRequestException(
          `Cannot retry payroll item ${item.id}: Bachs could not verify its payout status. Try again after provider status is available.`,
        );
      }
      if (terminalFailureStatuses.has(verifiedStatus)) {
        if (this.fundingLedger) {
          await this.fundingLedger.releaseFailedPayoutReservationsForItem({
            tenantId,
            payrollRunId: item.payrollRunId,
            payrollItemId: item.id,
            provider: PaymentProvider.BACHS,
            providerReference: reference,
            evidence: {
              verifiedStatus,
              merchantReference: merchantRef,
              verificationSource: 'provider_status_query',
            },
          });
        }
        return true;
      }
      if (SUCCESS_STATUSES.has(verifiedStatus) || PENDING_STATUSES.has(verifiedStatus)) {
        await this.applyTransferStatus(
          merchantRef,
          verifiedStatus,
          reference,
          provider,
          tenantId,
          amount,
        );
        return false;
      }
      throw new BadRequestException(
        `Cannot retry payroll item ${item.id}: Bachs returned non-terminal payout status "${verifiedStatus}".`,
      );
    }

    if (!status) return true;

    const changed = await this.applyTransferStatus(
      merchantRef,
      status,
      reference,
      provider,
      tenantId,
      amount,
    );
    if (changed) return FAILED_STATUSES.has(status.toUpperCase());
    return FAILED_STATUSES.has(status.toUpperCase());
  }

  async applyTransferStatus(
    merchantRef: string,
    rawStatus: string,
    transactionId: string,
    provider: PaymentProvider = PaymentProvider.NOMBA,
    tenantId?: string,
    amount?: number,
  ): Promise<boolean> {
    const parsed = parsePayrollMerchantRef(merchantRef);
    if (!parsed) return false;

    const { payrollRunId, payrollItemId: itemId } = parsed;
    const status = rawStatus.toUpperCase();
    const normalizedStatus = normalizePayoutStatus(provider, rawStatus);
    const providerName = paymentProviderLabel(provider);
    if (!normalizedStatus) {
      this.logger.warn(`Unknown ${providerName} payout status: ${rawStatus}`);
      return false;
    }
    const resolvedTenantId = tenantId ?? (await this.resolveTenantId(payrollRunId ?? ''));
    const outcome: { item: PayrollItem | null; kind: 'paid' | 'failed' | null } = {
      item: null,
      kind: null,
    };

    const changed = await this.payrollItemRepo.manager.transaction(async (manager) => {
      const repository = manager.getRepository(PayrollItem);
      const where: Record<string, unknown> = { id: itemId };
      if (payrollRunId) where.payrollRunId = payrollRunId;

      if (payrollRunId && resolvedTenantId) {
        const payrollRun = await manager.getRepository(PayrollRun).findOne({
          where: { id: payrollRunId, tenantId: resolvedTenantId },
          select: ['id', 'tenantId'],
        });
        if (!payrollRun) return false;
      }

      // Lock only the payroll_item row. Loading relations here generates LEFT OUTER JOINs,
      // and PostgreSQL rejects FOR UPDATE when it would also lock the nullable side.
      const item = await repository.findOne({
        where,
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) return false;

      if (normalizedStatus === 'completed') {
        if (item.status === PayrollItemStatus.PAID) return false;
        if (
          item.metadata?.fxAtPayout !== true &&
          amount != null &&
          Number.isFinite(amount) &&
          Math.abs(Number(amount) - Number(item.paymentAmount)) > PAYROLL_AMOUNT_TOLERANCE
        ) {
          this.logger.error(
            `Payroll amount mismatch for item ${itemId}: expected ${item.paymentAmount}, got ${amount}; leaving PROCESSING`,
          );
          if (item.status !== PayrollItemStatus.PENDING) return false;
          item.status = PayrollItemStatus.PROCESSING;
          item.transactionId = transactionId;
          item.paymentProvider = providerName;
          await repository.save(item);
          return true;
        }

        if (
          item.status !== PayrollItemStatus.PENDING &&
          item.status !== PayrollItemStatus.PROCESSING
        ) {
          return false;
        }
        item.status = PayrollItemStatus.PAID;
        item.transactionId = transactionId;
        item.paymentProvider = providerName;
        item.paidAt = new Date();
        item.failureReason = null;
        await repository.save(item);
        outcome.item = await repository.findOne({
          where: { id: item.id },
          relations: ['payrollRun', 'employee'],
        });
        outcome.kind = 'paid';
        return true;
      }

      if (normalizedStatus === 'failed') {
        if (item.status === PayrollItemStatus.FAILED || item.status === PayrollItemStatus.PAID) {
          return false;
        }
        if (
          item.status !== PayrollItemStatus.PENDING &&
          item.status !== PayrollItemStatus.PROCESSING
        ) {
          return false;
        }
        item.status = PayrollItemStatus.FAILED;
        item.transactionId = transactionId;
        item.paymentProvider = providerName;
        item.failureReason = `${providerName} ${status.toLowerCase()}`;
        await repository.save(item);
        outcome.item = await repository.findOne({
          where: { id: item.id },
          relations: ['payrollRun', 'employee'],
        });
        outcome.kind = 'failed';
        this.logger.warn(`Payroll item ${itemId} failed: ${status}`);
        return true;
      }

      if (normalizedStatus === 'processing') {
        if (item.status !== PayrollItemStatus.PENDING && item.status !== PayrollItemStatus.FAILED) {
          return false;
        }
        item.status = PayrollItemStatus.PROCESSING;
        item.transactionId = transactionId;
        item.paymentProvider = providerName;
        item.failureReason = null;
        await repository.save(item);
        return true;
      }

      return false;
    });

    const changedItem = outcome.item;
    const changedKind = outcome.kind;
    if (changed && changedItem && resolvedTenantId && this.lifecycleNotify) {
      if (changedKind === 'paid') {
        await this.lifecycleNotify.onItemPaid({
          tenantId: resolvedTenantId,
          item: changedItem,
          run: changedItem.payrollRun,
          auditContext: {
            tenantId: resolvedTenantId,
            payrollRunId: changedItem.payrollRunId,
            performedById: changedItem.payrollRun?.createdById ?? changedItem.memberId,
            memberId: changedItem.memberId,
          },
        });
      } else if (changedKind === 'failed') {
        await this.lifecycleNotify.onItemFailed({
          tenantId: resolvedTenantId,
          item: changedItem,
          run: changedItem.payrollRun,
          reason: changedItem.failureReason ?? `${providerName} ${status.toLowerCase()}`,
          auditContext: {
            tenantId: resolvedTenantId,
            payrollRunId: changedItem.payrollRunId,
            performedById: changedItem.payrollRun?.createdById ?? changedItem.memberId,
            memberId: changedItem.memberId,
          },
        });
      }
    }

    if (
      changed &&
      changedKind === 'paid' &&
      provider === PaymentProvider.BACHS &&
      parsed.payrollRunId &&
      resolvedTenantId &&
      this.fundingLedger
    ) {
      try {
        const querier = this.factory.resolvePayoutQuerier(PaymentProvider.BACHS);
        const payout = await querier?.queryStatus(transactionId, merchantRef);
        if (
          payout?.sourceDebitedAmount != null &&
          Number.isFinite(payout.sourceDebitedAmount) &&
          payout.sourceDebitedAmount > 0 &&
          payout.sourceCurrency
        ) {
          await this.fundingLedger.recordConfirmedPayoutDebit({
            tenantId: resolvedTenantId,
            payrollRunId: parsed.payrollRunId,
            payrollItemId: itemId,
            amount: payout.sourceDebitedAmount,
            currency: payout.sourceCurrency,
            provider: PaymentProvider.BACHS,
            providerReference: transactionId,
            evidence: {
              verifiedStatus: payout.status,
              merchantReference: merchantRef,
              destinationAmount: amount ?? null,
              sourceDebitedAmount: payout.sourceDebitedAmount,
              sourceCurrency: payout.sourceCurrency,
            },
          });
        } else {
          this.logger.warn(
            `Bachs payout ${transactionId} completed but source debit could not be verified; payroll retry remains blocked`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Could not record verified Bachs debit for payroll item ${itemId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return changed;
  }

  classifyPaymentResultStatus(rawStatus?: string): 'paid' | 'processing' | 'failed' {
    const status = (rawStatus ?? '').toUpperCase();
    if (SUCCESS_STATUSES.has(status)) return 'paid';
    if (FAILED_STATUSES.has(status)) return 'failed';
    return 'processing';
  }

  async reconcilePayrollRunStatus(payrollRunId: string, tenantId: string): Promise<void> {
    const run = await this.payrollRunRepository.findByIdWithItems(payrollRunId, tenantId);
    if (!run) return;
    const items = run.items;
    if (items.length === 0) return;

    const approvedAt = run.metadata?.approvedAt;
    const postApproval =
      (typeof approvedAt === 'string' && approvedAt.length > 0) ||
      run.status === PayrollStatus.APPROVED ||
      run.status === PayrollStatus.COMPLETED ||
      run.status === PayrollStatus.FAILED;
    if (!postApproval) {
      return;
    }

    let pending = 0;
    let processing = 0;
    let paid = 0;
    let failed = 0;
    let cancelled = 0;

    for (const item of items) {
      switch (item.status) {
        case PayrollItemStatus.PENDING:
          pending += 1;
          break;
        case PayrollItemStatus.PROCESSING:
          processing += 1;
          break;
        case PayrollItemStatus.PAID:
          paid += 1;
          break;
        case PayrollItemStatus.FAILED:
          failed += 1;
          break;
        case PayrollItemStatus.CANCELLED:
          cancelled += 1;
          break;
        default:
          break;
      }
    }

    const active = items.length - cancelled;
    if (active <= 0) {
      run.status = PayrollStatus.CANCELLED;
      await this.payrollRunRepository.save(run);
      return;
    }

    const _inFlight = pending + processing;

    run.status = resolvePostApprovalPayrollStatus({
      pending,
      processing,
      paid,
      failed,
      active,
    });
    if (run.status === PayrollStatus.COMPLETED) {
      run.processedAt = run.processedAt ?? new Date();
    }

    await this.payrollRunRepository.save(run);
  }
}

/** Post-approval run status from item counts. Never returns `processing` (that means pre-approve). */
export function resolvePostApprovalPayrollStatus(counts: {
  pending: number;
  processing: number;
  paid: number;
  failed: number;
  active: number;
}): PayrollStatus {
  const inFlight = counts.pending + counts.processing;
  if (counts.active <= 0) return PayrollStatus.CANCELLED;
  if (inFlight > 0) return PayrollStatus.APPROVED;
  if (counts.paid === counts.active) return PayrollStatus.COMPLETED;
  if (counts.failed === counts.active) return PayrollStatus.FAILED;
  if (counts.paid > 0 && counts.failed > 0) return PayrollStatus.APPROVED;
  if (counts.paid > 0) return PayrollStatus.COMPLETED;
  return PayrollStatus.FAILED;
}
