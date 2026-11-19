import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import { LessThan, Repository } from 'typeorm';

import { PayrollItem } from '../entities/payroll-item.entity';
import { updatePayrollItemScopedIfStatus } from '../repositories/payroll-item-write.util';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { buildPayrollMerchantRef } from '../utils/payroll-merchant-ref.util';
import { PayoutApplyOps } from './payout-apply.ops';
import { PayoutLookupOps } from './payout-lookup.ops';
import { NULL_TRANSACTION_STUCK_GRACE_MS } from './payout-reconciliation.shared';
import { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';

@Injectable()
export class PayoutStuckOps {
  private readonly logger = new Logger('PayoutReconciliation');

  constructor(
    private readonly factory: PaymentProviderFactoryService,
    private readonly payrollRunRepository: PayrollRunRepository,
    @InjectRepository(PayrollItem)
    private readonly payrollItemRepo: Repository<PayrollItem>,
    private readonly apply: PayoutApplyOps,
    private readonly lookup: PayoutLookupOps,
    @Optional()
    private readonly lifecycleNotify?: PayrollLifecycleNotifyService,
  ) {}

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
      try {
        const stuckItems = await this.payrollItemRepo.find({
          where: {
            status: PayrollItemStatus.PROCESSING,
            updatedAt: LessThan(cutoff),
            payrollRun: { tenantId },
          },
          // Load the relations the failure notification reads: without `employee` the email falls
          // back to a raw member UUID, and without `payrollRun` every item costs an extra
          // resolveTenantId round trip.
          relations: { employee: true, payrollRun: true },
          take: 50,
        });
        checked += stuckItems.length;

        for (const item of stuckItems) {
          const changed = await this.reconcileStuckItem(item, tenantId);
          if (changed) updated += 1;
        }
      } catch (error) {
        // One tenant's rows must not abort the sweep for every other tenant, and a failed
        // sweep must still report what it managed to check.
        this.logger.warn(
          `Stuck payout sweep failed for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`,
        );
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

    const provider = this.lookup.resolveStoredProvider(item.paymentProvider);
    if (!provider) {
      this.logger.warn(`Payroll item ${item.id} has no recognized provider reference to reconcile`);
      return false;
    }
    const retryAttempt = this.lookup.currentMerchantRetryAttempt(item, provider);
    const merchantRef = buildPayrollMerchantRef(item.payrollRunId, item.id, retryAttempt);
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

    const changed = await this.apply.applyTransferStatus(
      merchantRef,
      status,
      reference,
      provider,
      tenantId,
      amount,
    );
    if (changed) {
      await this.lookup.reconcilePayrollRunStatus(item.payrollRunId, tenantId);
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

    const tenantId =
      item.payrollRun?.tenantId ?? (await this.lookup.resolveTenantId(item.payrollRunId));
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

    await this.lookup.reconcilePayrollRunStatus(item.payrollRunId, tenantId);
    return true;
  }
}
