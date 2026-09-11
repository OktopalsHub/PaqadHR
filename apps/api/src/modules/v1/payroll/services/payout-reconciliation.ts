import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import { FincraApiService } from 'src/common/services/fincra-api.service';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import { paymentProviderLabel } from 'src/common/utils/resolve-payment-provider.util';
import { LessThan, Repository } from 'typeorm';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import {
  buildPayrollMerchantRef,
  parsePayrollMerchantRef,
} from '../utils/payroll-merchant-ref.util';
import type { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';

const PAYROLL_AMOUNT_TOLERANCE = 1;

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
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly payrollRunRepository: PayrollRunRepository,
    @InjectRepository(PayrollItem)
    private readonly payrollItemRepo: Repository<PayrollItem>,
    private readonly lifecycleNotify?: PayrollLifecycleNotifyService,
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
    if (value.includes('noah') || value.includes('international') || value.includes('crypto'))
      return PaymentProvider.NOAH;
    if (value.includes('monnify')) return PaymentProvider.MONNIFY;
    return PaymentProvider.NOMBA;
  }

  async requeryStuckPayouts(): Promise<{ checked: number; updated: number }> {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const stuckItems = await this.payrollItemRepo.find({
      where: {
        status: PayrollItemStatus.PROCESSING,
        updatedAt: LessThan(cutoff),
      },
      take: 50,
    });

    let updated = 0;
    for (const item of stuckItems) {
      const reference = item.transactionId;
      if (!reference) continue;

      const tenantId = item.payrollRun?.tenantId ?? (await this.resolveTenantId(item.payrollRunId));
      if (!tenantId) continue;

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

      if (!status) continue;

      const changed = await this.applyTransferStatus(
        merchantRef,
        status,
        reference,
        provider,
        tenantId,
        amount,
      );
      if (changed) {
        updated += 1;
        await this.reconcilePayrollRunStatus(item.payrollRunId, tenantId);
      }
    }

    return { checked: stuckItems.length, updated };
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
    const where: Record<string, unknown> = { id: itemId };
    if (payrollRunId) {
      where.payrollRunId = payrollRunId;
    }
    if (tenantId) {
      where.payrollRun = { tenantId };
    }
    const item = await this.payrollItemRepository.findOne({
      where,
      relations: ['payrollRun', 'employee'],
    });
    if (!item) return false;
    if (tenantId) {
      const runTenantId =
        item.payrollRun?.tenantId ??
        (payrollRunId ? await this.resolveTenantId(payrollRunId) : undefined) ??
        (await this.resolveTenantId(item.payrollRunId));
      if (runTenantId && runTenantId !== tenantId) return false;
    }

    const status = rawStatus.toUpperCase();
    const providerName = paymentProviderLabel(provider);
    const resolvedTenantId =
      tenantId ?? item.payrollRun?.tenantId ?? (await this.resolveTenantId(item.payrollRunId));

    if (SUCCESS_STATUSES.has(status)) {
      if (item.status === PayrollItemStatus.PAID) return false;
      if (
        amount != null &&
        Number.isFinite(amount) &&
        Math.abs(Number(amount) - Number(item.paymentAmount)) > PAYROLL_AMOUNT_TOLERANCE
      ) {
        this.logger.error(
          `Payroll amount mismatch for item ${itemId}: expected ${item.paymentAmount}, got ${amount}; leaving PROCESSING`,
        );
        if (item.status === PayrollItemStatus.PENDING) {
          item.status = PayrollItemStatus.PROCESSING;
          item.transactionId = transactionId;
          item.paymentProvider = providerName;
          await this.payrollItemRepository.save(item);
          return true;
        }
        return false;
      }
      item.status = PayrollItemStatus.PAID;
      item.transactionId = transactionId;
      item.paymentProvider = providerName;
      item.paidAt = new Date();
      item.failureReason = null;
      await this.payrollItemRepository.save(item);
      if (resolvedTenantId && this.lifecycleNotify) {
        await this.lifecycleNotify.onItemPaid({
          tenantId: resolvedTenantId,
          item,
          run: item.payrollRun,
          auditContext: {
            tenantId: resolvedTenantId,
            payrollRunId: item.payrollRunId,
            performedById: item.payrollRun?.createdById ?? item.memberId,
            memberId: item.memberId,
          },
        });
      }
      return true;
    }

    if (FAILED_STATUSES.has(status)) {
      if (item.status === PayrollItemStatus.FAILED) return false;
      if (item.status === PayrollItemStatus.PAID) return false;
      item.status = PayrollItemStatus.FAILED;
      item.transactionId = transactionId;
      item.failureReason = `${providerName} ${status.toLowerCase()}`;
      await this.payrollItemRepository.save(item);
      this.logger.warn(`Payroll item ${itemId} failed: ${status}`);
      if (resolvedTenantId && this.lifecycleNotify) {
        await this.lifecycleNotify.onItemFailed({
          tenantId: resolvedTenantId,
          item,
          run: item.payrollRun,
          reason: item.failureReason,
          auditContext: {
            tenantId: resolvedTenantId,
            payrollRunId: item.payrollRunId,
            performedById: item.payrollRun?.createdById ?? item.memberId,
            memberId: item.memberId,
          },
        });
      }
      return true;
    }

    if (PENDING_STATUSES.has(status) && item.status === PayrollItemStatus.PENDING) {
      item.status = PayrollItemStatus.PROCESSING;
      item.transactionId = transactionId;
      item.paymentProvider = providerName;
      await this.payrollItemRepository.save(item);
      return true;
    }

    if (PENDING_STATUSES.has(status) && item.status === PayrollItemStatus.FAILED) {
      item.status = PayrollItemStatus.PROCESSING;
      item.transactionId = transactionId;
      item.paymentProvider = providerName;
      item.failureReason = null;
      await this.payrollItemRepository.save(item);
      return true;
    }

    return false;
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
