import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { AuditContext } from 'src/common/interfaces/audit-context.interface';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import type { BatchPaymentResult } from '../../../../common/interfaces/batch-payment-result.interface';
import { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import { isPayrollGatewayEnabled } from '../config/payroll-disbursement.config';
import type { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { PaymentBatching } from './payment-batching';
import { PaymentValidation } from './payment-validation';
import { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';
import { PayrollPayoutService } from './payroll-payout.service';

@Injectable()
export class MultiPaymentService {
  private readonly batching: PaymentBatching;
  private readonly validation: PaymentValidation;
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollItemRepository: PayrollItemRepository,
    readonly paymentMethodService: PaymentMethodService,
    readonly paymentProviderFactory: PaymentProviderFactoryService,
    private readonly payrollPayoutService: PayrollPayoutService,
    @Optional() lifecycleNotify?: PayrollLifecycleNotifyService,
  ) {
    this.validation = new PaymentValidation(payrollItemRepository);
    this.batching = new PaymentBatching(
      payrollItemRepository,
      paymentMethodService,
      paymentProviderFactory,
      payrollPayoutService,
      lifecycleNotify,
    );
  }
  async processMultiPaymentPayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<BatchPaymentResult> {
    if (!isPayrollGatewayEnabled()) {
      throw new BadRequestException(
        'Payroll gateway is not configured. Use manual disburse or configure Nomba/Monnify/Fincra (NGN) and/or Noah/Fincra credentials.',
      );
    }
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items', 'items.employee', 'tenant'],
    });
    if (!payrollRun) {
      throw new NotFoundException('Payroll run not found');
    }
    if (
      payrollRun.status !== PayrollStatus.APPROVED &&
      payrollRun.status !== PayrollStatus.PROCESSING
    ) {
      throw new BadRequestException(
        `Payroll run must be approved before payout. Current: ${payrollRun.status}`,
      );
    }
    if (payrollRun.payoutMode === 'scheduled') {
      payrollRun.payoutMode = 'immediate';
      await this.payrollRunRepository.save(payrollRun);
    }
    const paymentBatch = await this.batching.categorizePayments(
      payrollRun.items,
      tenantId,
      payrollRun.baseCurrency,
    );
    const payable = [...paymentBatch.bankPayments, ...paymentBatch.cryptoPayments];
    if (payable.length === 0) {
      await this.payrollPayoutService.reconcilePayrollRunStatus(payrollRunId, tenantId);
      throw new BadRequestException(
        'No employees could be paid. Check each employee payment method and that your payout provider account is funded, then use Retry payment.',
      );
    }
    const payoutResults = await this.batching.processPayouts(
      payable,
      auditContext,
      tenantId,
      payrollRun.tenant?.name,
      payrollRun.title,
      {
        periodStart: payrollRun.periodStart,
        periodEnd: payrollRun.periodEnd,
        baseCurrency: payrollRun.baseCurrency,
      },
    );
    const summary = this.validation.calculatePaymentSummary(payoutResults);
    await this.payrollPayoutService.reconcilePayrollRunStatus(payrollRunId, tenantId);
    return {
      totalItems: payrollRun.items.length,
      successfulPayments: summary.bankSuccess + summary.cryptoSuccess,
      failedPayments: summary.bankFailed + summary.cryptoFailed,
      processingPayments: summary.bankProcessing + summary.cryptoProcessing,
      fiatResults: payoutResults,
      payoutResults,
      summary,
    };
  }
  async retryFailedPayments(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
    specificItemIds?: string[],
  ): Promise<BatchPaymentResult> {
    if (!isPayrollGatewayEnabled()) {
      throw new BadRequestException(
        'Payroll gateway is not configured. Configure Nomba/Monnify/Fincra (NGN) and/or Noah/Fincra credentials.',
      );
    }
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items', 'items.employee', 'tenant'],
    });
    if (!payrollRun) {
      throw new NotFoundException('Payroll run not found');
    }
    let failedItems = payrollRun.items.filter((item) => item.status === PayrollItemStatus.FAILED);
    if (specificItemIds && specificItemIds.length > 0) {
      failedItems = failedItems.filter((item) => specificItemIds.includes(item.id));
    }
    if (failedItems.length === 0) {
      throw new BadRequestException('No failed payments found to retry');
    }
    const retriableItems: PayrollItem[] = [];
    for (const item of failedItems) {
      const canRetry = await this.payrollPayoutService.reconcileFailedItemBeforeRetry(
        item,
        tenantId,
      );
      if (canRetry) {
        retriableItems.push(item);
      }
    }
    if (retriableItems.length === 0) {
      throw new BadRequestException('No failed payments found to retry');
    }
    await this.validation.resetItemsForRetry(retriableItems);
    const paymentBatch = await this.batching.categorizePayments(
      retriableItems,
      tenantId,
      payrollRun.baseCurrency,
    );
    const payable = [...paymentBatch.bankPayments, ...paymentBatch.cryptoPayments];
    if (payable.length === 0) {
      await this.payrollPayoutService.reconcilePayrollRunStatus(payrollRunId, tenantId);
      throw new BadRequestException(
        'No employees could be paid. Check each employee payment method and that your payout provider account is funded, then retry again.',
      );
    }
    const payoutResults = await this.batching.processPayouts(
      payable,
      auditContext,
      tenantId,
      payrollRun.tenant?.name,
      payrollRun.title,
      {
        periodStart: payrollRun.periodStart,
        periodEnd: payrollRun.periodEnd,
        baseCurrency: payrollRun.baseCurrency,
      },
    );
    const summary = this.validation.calculatePaymentSummary(payoutResults);
    await this.payrollPayoutService.reconcilePayrollRunStatus(payrollRunId, tenantId);
    return {
      totalItems: retriableItems.length,
      successfulPayments: summary.bankSuccess + summary.cryptoSuccess,
      failedPayments: summary.bankFailed + summary.cryptoFailed,
      processingPayments: summary.bankProcessing + summary.cryptoProcessing,
      fiatResults: payoutResults,
      payoutResults,
      summary,
    };
  }
  async getPaymentStatusSummary(payrollRunId: string, tenantId: string) {
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      select: ['id'],
    });
    if (!payrollRun) {
      throw new NotFoundException('Payroll run not found');
    }
    const items = await this.payrollItemRepository.findByPayrollRunId(payrollRunId, tenantId);
    const statusCounts = items.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
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
