import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { isBridgeConfigured } from '../../../../common/config/bridge.config';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import type { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import type { BatchPaymentResult } from '../../../../common/interfaces/batch-payment-result.interface';
import type { PaymentResult } from '../../../../common/interfaces/payment-result.interface';
import type { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { PAYROLL_PROCESSING_LOCK_MS } from '../utils/payroll-processing-lock.util';
import { BridgePayrollPayoutService } from './bridge-payroll-payout.service';
import { NombaPayrollPayoutService } from './nomba-payroll-payout.service';
import { PaymentValidation } from './payment-validation';
import { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';
import { PayrollPayoutService } from './payroll-payout.service';

export function noPayableEmployeesMessage(items: PayrollItem[], suffix: string): string {
  const active = items.filter((item) => item.status !== PayrollItemStatus.CANCELLED);
  const settled = active.filter(
    (item) =>
      item.status === PayrollItemStatus.PAID || item.status === PayrollItemStatus.PROCESSING,
  );
  if (active.length === 0) {
    return 'Every employee on this run was cancelled, so there is nothing to pay.';
  }
  if (settled.length === active.length) {
    return active.every((item) => item.status === PayrollItemStatus.PAID)
      ? 'Every employee on this run has already been paid.'
      : 'Payment for this run is already in progress. It updates when each payout completes — no need to pay again.';
  }
  return `No employees could be paid. Confirm each employee has an eligible Bridge wallet and the organization wallet is funded, ${suffix}`;
}

@Injectable()
export class MultiPaymentService {
  private readonly validation: PaymentValidation;

  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly payrollPayoutService: PayrollPayoutService,
    private readonly bridgePayrollPayout: BridgePayrollPayoutService,
    private readonly nombaPayrollPayout: NombaPayrollPayoutService,
    private readonly lifecycleNotify?: PayrollLifecycleNotifyService,
  ) {
    this.validation = new PaymentValidation(payrollItemRepository);
  }

  async processMultiPaymentPayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<BatchPaymentResult> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: { items: true, tenant: true },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== PayrollStatus.APPROVED && run.status !== PayrollStatus.PROCESSING) {
      throw new BadRequestException(
        `Payroll run must be approved before payout. Current: ${run.status}`,
      );
    }
    const hasNgnPayrollItems = (run.items ?? []).some(
      (item) =>
        item.status !== PayrollItemStatus.CANCELLED &&
        item.paymentCurrency?.toUpperCase() === 'NGN',
    );
    const floatTopup = run.metadata?.floatTopup as
      | { status?: unknown; provider?: unknown }
      | undefined;
    if (
      hasNgnPayrollItems &&
      (!floatTopup ||
        typeof floatTopup !== 'object' ||
        floatTopup.status !== 'completed' ||
        floatTopup.provider !== 'nomba')
    ) {
      throw new BadRequestException(
        'NGN payroll must be funded through its Nomba checkout before employee payouts can start.',
      );
    }

    const lockAt = new Date();
    if (!(await this.claimPayrollRun(payrollRunId, tenantId, auditContext, lockAt))) {
      throw new BadRequestException('Payroll run is already being processed');
    }
    try {
      if (run.payoutMode === 'scheduled' && this.lifecycleNotify) {
        await this.lifecycleNotify.onScheduledPayoutDue({
          tenantId,
          run: {
            id: run.id,
            title: run.title,
            tenantId,
            periodStart: run.periodStart,
            periodEnd: run.periodEnd,
            paymentDate: run.paymentDate,
          },
        });
      }
      if (run.payoutMode === 'scheduled') {
        run.payoutMode = 'immediate';
        await this.payrollRunRepository.save(run);
      }
      const pending = run.items.filter((item) => item.status === PayrollItemStatus.PENDING);
      if (pending.length === 0) {
        await this.payrollPayoutService.reconcilePayrollRunStatus(payrollRunId, tenantId);
        throw new BadRequestException(
          noPayableEmployeesMessage(run.items, 'then use Retry payment.'),
        );
      }
      const payoutResults = await this.processByProvider(run, pending, tenantId);
      return this.toBatchResult(run.items.length, payoutResults);
    } finally {
      await this.releasePayrollRun(payrollRunId, tenantId, lockAt);
    }
  }

  async retryFailedPayments(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
    specificItemIds?: string[],
  ): Promise<BatchPaymentResult> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: { items: true, tenant: true },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    let failed = run.items.filter((item) => item.status === PayrollItemStatus.FAILED);
    if (specificItemIds?.length) {
      const selected = new Set(specificItemIds);
      if (selected.size !== specificItemIds.length) {
        throw new BadRequestException('Retry item selection is invalid. Refresh the payroll run.');
      }
      const selectedFromRun = run.items.filter((item) => selected.has(item.id));
      if (selectedFromRun.length !== selected.size) {
        throw new BadRequestException('One or more retry items do not belong to this payroll run.');
      }
      if (selectedFromRun.some((item) => item.status !== PayrollItemStatus.FAILED)) {
        throw new BadRequestException('Only failed payroll items can be retried. Refresh the run.');
      }
      failed = failed.filter((item) => selected.has(item.id));
    }
    if (failed.length === 0) throw new BadRequestException('No failed payments found to retry');

    const legacyItems = failed.filter((item) => {
      const provider = item.paymentProvider?.toLowerCase();
      const expectedProvider = item.paymentCurrency?.toUpperCase() === 'NGN' ? 'nomba' : 'bridge';
      return provider && provider !== expectedProvider;
    });
    if (legacyItems.length > 0) {
      throw new BadRequestException(
        'A legacy-provider payout cannot be retried through Bridge until its original provider confirms the payout is terminal.',
      );
    }

    // Nomba failures must still be terminal at the provider before a fresh merchant reference
    // is minted. A lost or stale webhook cannot authorize a second bank transfer.
    const nombaItems = failed.filter((item) => item.paymentCurrency?.toUpperCase() === 'NGN');
    for (const item of nombaItems) {
      const retryable = await this.payrollPayoutService.reconcileFailedItemBeforeRetry(
        item,
        tenantId,
      );
      if (!retryable) {
        throw new BadRequestException(
          `Payroll item ${item.id} is no longer confirmed failed by Nomba. Refresh the run before retrying.`,
        );
      }
    }

    const lockAt = new Date();
    if (!(await this.claimPayrollRun(payrollRunId, tenantId, auditContext, lockAt))) {
      throw new BadRequestException('Payroll run is already being processed');
    }
    try {
      const payoutResults = await this.processByProvider(run, failed, tenantId);
      return this.toBatchResult(failed.length, payoutResults);
    } finally {
      await this.releasePayrollRun(payrollRunId, tenantId, lockAt);
    }
  }

  private async processByProvider(
    run: import('../entities/payroll-run.entity').PayrollRun,
    items: PayrollItem[],
    tenantId: string,
  ): Promise<PaymentResult[]> {
    const ngnItems = items.filter((item) => item.paymentCurrency?.toUpperCase() === 'NGN');
    const bridgeItems = items.filter((item) => item.paymentCurrency?.toUpperCase() !== 'NGN');
    if (bridgeItems.length && !isBridgeConfigured()) {
      throw new BadRequestException(
        'Bridge payroll is not configured. Add Bridge credentials and enable the exact payroll payout routes.',
      );
    }
    const results: PaymentResult[] = [];
    if (ngnItems.length) {
      results.push(...(await this.nombaPayrollPayout.processRun(run, ngnItems, tenantId)));
    }
    if (bridgeItems.length) {
      results.push(...(await this.bridgePayrollPayout.processRun(run, bridgeItems, tenantId)));
    }
    return results;
  }

  private toBatchResult(totalItems: number, payoutResults: PaymentResult[]): BatchPaymentResult {
    const summary = this.validation.calculatePaymentSummary(payoutResults);
    return {
      totalItems,
      successfulPayments: summary.bankSuccess + summary.cryptoSuccess,
      failedPayments: summary.bankFailed + summary.cryptoFailed,
      processingPayments: summary.bankProcessing + summary.cryptoProcessing,
      fiatResults: payoutResults,
      payoutResults,
      summary,
    };
  }

  private async claimPayrollRun(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
    lockAt: Date,
  ): Promise<boolean> {
    const cutoff = new Date(lockAt.getTime() - PAYROLL_PROCESSING_LOCK_MS);
    const result = await this.payrollRunRepository
      .createQueryBuilder()
      .update()
      .set({
        processingLockedAt: lockAt,
        processingLockedById: auditContext.performedById ?? null,
      })
      .where('id = :payrollRunId AND tenant_id = :tenantId', { payrollRunId, tenantId })
      .andWhere('status IN (:...statuses)', {
        statuses: [PayrollStatus.APPROVED, PayrollStatus.PROCESSING],
      })
      .andWhere('(processing_locked_at IS NULL OR processing_locked_at < :cutoff)', { cutoff })
      .execute();
    return (result.affected ?? 0) === 1;
  }

  private async releasePayrollRun(
    payrollRunId: string,
    tenantId: string,
    lockAt: Date,
  ): Promise<void> {
    await this.payrollRunRepository
      .createQueryBuilder()
      .update()
      .set({ processingLockedAt: null, processingLockedById: null })
      .where('id = :payrollRunId AND tenant_id = :tenantId', { payrollRunId, tenantId })
      .andWhere('processing_locked_at = :lockAt', { lockAt })
      .execute();
  }

  async getPaymentStatusSummary(payrollRunId: string, tenantId: string) {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    const items = await this.payrollItemRepository.findByPayrollRunId(payrollRunId, tenantId);
    const statusCounts = items.reduce(
      (counts, item) => {
        counts[item.status] = (counts[item.status] || 0) + 1;
        return counts;
      },
      {} as Record<PayrollItemStatus, number>,
    );
    const paymentTypeCounts = await this.validation.getPaymentTypeBreakdown(items);
    return {
      total: items.length,
      statusBreakdown: statusCounts,
      paymentTypeBreakdown: paymentTypeCounts,
      canRetry: statusCounts[PayrollItemStatus.FAILED] > 0,
      isComplete:
        statusCounts[PayrollItemStatus.FAILED] === 0 &&
        statusCounts[PayrollItemStatus.PENDING] === 0,
    };
  }
}
