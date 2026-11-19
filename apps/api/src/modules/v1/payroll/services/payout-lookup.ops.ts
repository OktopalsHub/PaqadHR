import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import { isPayoutFailedStatus, isPayoutSuccessStatus } from 'src/common/utils/payout-status.util';
import { Repository } from 'typeorm';

import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { resolvePostApprovalPayrollStatus } from './payout-reconciliation.shared';

@Injectable()
export class PayoutLookupOps {
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    @InjectRepository(PayrollItem)
    private readonly payrollItemRepo: Repository<PayrollItem>,
  ) {}

  async resolveTenantId(payrollRunId: string): Promise<string | undefined> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId },
      select: { tenantId: true },
    });
    return run?.tenantId;
  }

  async resolveItemRunId(itemId: string, tenantId: string): Promise<string | undefined> {
    const item = await this.payrollItemRepo.findOne({
      where: { id: itemId, payrollRun: { tenantId } },
      select: { id: true, payrollRunId: true },
    });
    return item?.payrollRunId;
  }

  /**
   * True when the provider string persisted on an item resolves to `provider`.
   *
   * Items store `paymentProvider` as the display label (for example "Bachs transfer"), while
   * webhook and query paths pass a `PaymentProvider`. Comparing the raw strings (or the label)
   * silently skips recovery, so always compare through the resolver.
   */
  isSameProvider(stored: string | null | undefined, provider: PaymentProvider): boolean {
    return this.resolveStoredProvider(stored) === provider;
  }

  resolveStoredProvider(stored: string | null | undefined): PaymentProvider | undefined {
    const value = (stored ?? '').toLowerCase();
    if (value.includes('nomba') || value.includes('local bank')) return PaymentProvider.NOMBA;
    if (value.includes('bridge') || value.includes('international')) return PaymentProvider.BRIDGE;
    return undefined;
  }

  currentMerchantRetryAttempt(item: PayrollItem, provider: PaymentProvider): number {
    if (
      provider === PaymentProvider.NOMBA &&
      typeof item.metadata?.nombaPayoutAttempt === 'number'
    ) {
      return Math.max(0, item.metadata.nombaPayoutAttempt - 1);
    }
    return typeof item.metadata?.payoutRetryCount === 'number' ? item.metadata.payoutRetryCount : 0;
  }

  classifyPaymentResultStatus(rawStatus?: string): 'paid' | 'processing' | 'failed' {
    const status = (rawStatus ?? '').toUpperCase();
    if (isPayoutSuccessStatus(status)) return 'paid';
    if (isPayoutFailedStatus(status)) return 'failed';
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
