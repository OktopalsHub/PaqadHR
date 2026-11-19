import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import { normalizePayoutStatus } from 'src/common/utils/payout-status.util';
import { paymentProviderLabel } from 'src/common/utils/resolve-payment-provider.util';
import { Repository } from 'typeorm';

import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { parsePayrollMerchantRef } from '../utils/payroll-merchant-ref.util';
import { PayoutLookupOps } from './payout-lookup.ops';
import {
  NormalizedPayoutStatus,
  ParsedMerchantRef,
  TransferOutcome,
} from './payout-reconciliation.shared';
import { PayoutBranchOps } from './payout-status-branch.ops';
import { PayrollAttemptHistoryService } from './payroll-attempt-history.service';
import { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';
import { PayrollRunFundingLedgerService } from './payroll-run-funding-ledger.service';

@Injectable()
export class PayoutApplyOps {
  private readonly logger = new Logger('PayoutReconciliation');

  constructor(
    readonly _factory: PaymentProviderFactoryService,
    @InjectRepository(PayrollItem)
    private readonly payrollItemRepo: Repository<PayrollItem>,
    private readonly branch: PayoutBranchOps,
    private readonly lookup: PayoutLookupOps,
    @Optional()
    private readonly lifecycleNotify?: PayrollLifecycleNotifyService,
    @Optional()
    private readonly fundingLedger?: PayrollRunFundingLedgerService,
    @Optional()
    private readonly attemptHistory?: PayrollAttemptHistoryService,
  ) {}

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
    const normalizedStatus = normalizePayoutStatus(rawStatus);
    const providerName = paymentProviderLabel(provider);
    if (!normalizedStatus) {
      this.logger.warn(`Unknown ${providerName} payout status: ${rawStatus}`);
      return false;
    }
    const resolvedTenantId = tenantId ?? (await this.lookup.resolveTenantId(payrollRunId ?? ''));

    const outcome: { item: PayrollItem | null; kind: 'paid' | 'failed' | null } = {
      item: null,
      kind: null,
    };

    const isReversal = status === 'REVERSED' || status === 'REFUND';

    const changed = await this.payrollItemRepo.manager.transaction(async (manager) => {
      const repository = manager.getRepository(PayrollItem);
      const where: Record<string, unknown> = { id: itemId };
      if (payrollRunId) where.payrollRunId = payrollRunId;

      if (payrollRunId && resolvedTenantId) {
        const payrollRun = await manager.getRepository(PayrollRun).findOne({
          where: { id: payrollRunId, tenantId: resolvedTenantId },
          select: { id: true, tenantId: true },
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
        return this.branch.applyCompletedStatus({
          transactionId,
          provider,
          providerName,
          itemId,
          amount,
          outcome,
          item,
          repository,
        });
      }
      if (
        normalizedStatus === 'failed' &&
        isReversal &&
        item.status === PayrollItemStatus.PAID &&
        item.transactionId === transactionId &&
        this.lookup.isSameProvider(item.paymentProvider, provider)
      ) {
        return this.branch.applyReversalStatus({
          status,
          provider,
          providerName,
          itemId,
          outcome,
          item,
          repository,
        });
      }
      if (normalizedStatus === 'failed') {
        return this.branch.applyFailedStatus({
          status,
          transactionId,
          providerName,
          itemId,
          outcome,
          item,
          repository,
        });
      }
      if (normalizedStatus === 'processing') {
        return this.branch.applyProcessingStatus({ transactionId, providerName, item, repository });
      }
      return false;
    });

    await this.syncAttemptHistory({
      merchantRef,
      status,
      transactionId,
      provider,
      resolvedTenantId,
      payrollRunId,
      itemId,
      normalizedStatus,
      isReversal,
    });
    await this.notifyTransferOutcome({
      status,
      providerName,
      resolvedTenantId,
      payrollRunId,
      outcome,
      changed,
    });
    await this.branch.recoverPayoutDebit({
      merchantRef,
      status,
      transactionId,
      provider,
      resolvedTenantId,
      payrollRunId,
      itemId,
      amount,
      outcome,
      parsed,
    });

    return changed;
  }

  private async syncAttemptHistory(input: {
    merchantRef: string;
    status: string;
    transactionId: string;
    provider: PaymentProvider;
    resolvedTenantId: string | undefined;
    payrollRunId: ParsedMerchantRef['payrollRunId'];
    itemId: string;
    normalizedStatus: NormalizedPayoutStatus;
    isReversal: boolean;
  }): Promise<void> {
    const {
      merchantRef,
      status,
      transactionId,
      provider,
      resolvedTenantId,
      payrollRunId,
      itemId,
      normalizedStatus,
      isReversal,
    } = input;
    let reversalRecorded = !isReversal;
    if (isReversal && resolvedTenantId && this.fundingLedger) {
      const reversalRunId =
        payrollRunId ?? (await this.lookup.resolveItemRunId(itemId, resolvedTenantId));
      if (reversalRunId) {
        // Throws on failure so the provider retries; the item change above is idempotent.
        await this.fundingLedger.recordPayoutReversal({
          tenantId: resolvedTenantId,
          payrollRunId: reversalRunId,
          payrollItemId: itemId,
          provider,
          providerReference: transactionId,
          evidence: { merchantReference: merchantRef, providerStatus: status },
        });
        reversalRecorded = true;
      }
    }

    if (resolvedTenantId && this.attemptHistory && reversalRecorded) {
      const attemptStatus = isReversal
        ? 'reversed'
        : normalizedStatus === 'completed'
          ? 'payment_processed'
          : normalizedStatus === 'failed'
            ? 'failed'
            : 'processing';
      await this.attemptHistory.transitionPayoutAttempt({
        tenantId: resolvedTenantId,
        provider,
        merchantReference: merchantRef,
        status: attemptStatus,
        providerReference: transactionId,
      });
    }
  }

  private async notifyTransferOutcome(input: {
    status: string;
    providerName: string;
    resolvedTenantId: string | undefined;
    payrollRunId: ParsedMerchantRef['payrollRunId'];
    outcome: TransferOutcome;
    changed: boolean;
  }): Promise<void> {
    const { status, providerName, resolvedTenantId, outcome, changed } = input;
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
  }
}
