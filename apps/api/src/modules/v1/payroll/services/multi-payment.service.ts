import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { AuditContext } from 'src/common/interfaces/audit-context.interface';
import type { NombaProvider } from 'src/common/providers/nomba.provider';
import type { DataSource } from 'typeorm';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import type { BatchPaymentResult } from '../../../../common/interfaces/batch-payment-result.interface';
import type { PaymentBatch } from '../../../../common/interfaces/payment-batch.interface';
import type { PaymentResult } from '../../../../common/interfaces/payment-result.interface';
import type { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import { isManualPayrollDisbursement } from '../config/payroll-disbursement.config';
import type { PayrollItem } from '../entities/payroll-item.entity';
import type { PayrollRun } from '../entities/payroll-run.entity';
import type { PayrollItemRepository } from '../repositories/payroll-item.repository';
import type { PayrollRunRepository } from '../repositories/payroll-run.repository';

interface PaymentSummary {
  fiatSuccess: number;
  fiatFailed: number;
}

@Injectable()
export class MultiPaymentService {
  private readonly logger = new Logger(MultiPaymentService.name);
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly paymentMethodService: PaymentMethodService,
    readonly _dataSource: DataSource,
    private readonly nombaProvider: NombaProvider,
  ) {}
  async processMultiPaymentPayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<BatchPaymentResult> {
    if (isManualPayrollDisbursement()) {
      throw new BadRequestException(
        'Multi-payment is unavailable in manual disbursement mode. Approve and disburse the payroll run instead.',
      );
    }
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items', 'items.employee'],
    });
    if (!payrollRun) {
      throw new NotFoundException('Payroll run not found');
    }
    if (payrollRun.status !== PayrollStatus.PROCESSING) {
      throw new BadRequestException(
        `Payroll run must be in PROCESSING status. Current: ${payrollRun.status}`,
      );
    }
    const paymentBatch = await this.categorizePayments(payrollRun.items);
    this.logger.log(`Processing payment batch: ${paymentBatch.fiatPayments.length} bank payments`);
    const fiatPaymentResults = await this.processFiatPayments(
      paymentBatch.fiatPayments,
      auditContext,
    );
    const summary = this.calculatePaymentSummary(fiatPaymentResults);
    await this.updatePayrollRunStatus(payrollRun, summary, auditContext);
    const result: BatchPaymentResult = {
      totalItems: payrollRun.items.length,
      successfulPayments: summary.fiatSuccess,
      failedPayments: summary.fiatFailed,
      fiatResults: fiatPaymentResults,
      summary,
    };
    return result;
  }
  async retryFailedPayments(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
    specificItemIds?: string[],
  ): Promise<BatchPaymentResult> {
    if (isManualPayrollDisbursement()) {
      throw new BadRequestException('Payment retry is unavailable in manual disbursement mode.');
    }
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items', 'items.employee'],
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
    this.logger.log(
      `Retrying ${failedItems.length} failed payments for payroll run ${payrollRunId}`,
    );
    await this.resetItemsForRetry(failedItems);
    const paymentBatch = await this.categorizePayments(failedItems);
    const fiatPaymentResults = await this.processFiatPayments(
      paymentBatch.fiatPayments,
      auditContext,
    );
    const summary = this.calculatePaymentSummary(fiatPaymentResults);
    const remainingFailedCount = await this.payrollItemRepository.count({
      where: { payrollRunId, status: PayrollItemStatus.FAILED },
    });
    if (remainingFailedCount === 0) {
      payrollRun.status = PayrollStatus.COMPLETED;
      await this.payrollRunRepository.save(payrollRun);
    }
    const result: BatchPaymentResult = {
      totalItems: failedItems.length,
      successfulPayments: summary.fiatSuccess,
      failedPayments: summary.fiatFailed,
      fiatResults: fiatPaymentResults,
      summary,
    };
    return result;
  }
  async getPaymentStatusSummary(payrollRunId: string, tenantId: string) {
    const items = await this.payrollItemRepository.findByPayrollRunId(payrollRunId);
    const statusCounts = items.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      {} as Record<PayrollItemStatus, number>,
    );
    const paymentTypeCounts = await this.getPaymentTypeBreakdown(items);
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
  private async categorizePayments(items: PayrollItem[]): Promise<PaymentBatch> {
    const fiatPayments: PayrollItem[] = [];
    for (const item of items) {
      const paymentMethod = await this.paymentMethodService.findByMemberId(item.memberId);
      if (!paymentMethod) {
        this.logger.warn(`No payment method found for member ${item.memberId}, skipping`);
        continue;
      }
      fiatPayments.push(item);
    }
    return { fiatPayments };
  }
  private async processFiatPayments(
    items: PayrollItem[],
    auditContext: AuditContext,
  ): Promise<PaymentResult[]> {
    const results: PaymentResult[] = [];
    for (const item of items) {
      try {
        await this.payrollItemRepository.update(item.id, {
          status: PayrollItemStatus.PROCESSING,
        });
        const _paymentMethod = await this.paymentMethodService.findByMemberId(item.memberId);
        const provider = this.nombaProvider;
        const paymentData = {
          amount: item.paymentAmount,
          currency: item.paymentCurrency,
          description: `Payroll payment - ${item.employee?.firstName} ${item.employee?.lastName}`,
          metadata: {
            payrollRunId: item.payrollRunId,
            payrollItemId: item.id,
            memberId: item.memberId,
            paymentType: 'fiat',
          },
        };
        const result = await provider.createPayment(paymentData);
        if (result.success) {
          await this.payrollItemRepository.update(item.id, {
            status: PayrollItemStatus.PAID,
            transactionId: result.transactionId,
            paymentProvider: provider.constructor.name,
            paidAt: new Date(),
            failureReason: null,
          });
          results.push({
            success: true,
            transactionId: result.transactionId,
            provider: provider.constructor.name,
          });
        } else {
          throw new BadRequestException(result.error || 'Payment failed');
        }
      } catch (error) {
        await this.payrollItemRepository.update(item.id, {
          status: PayrollItemStatus.FAILED,
          failureReason: error.message,
        });
        results.push({
          success: false,
          error: error.message,
        });
      }
    }
    return results;
  }
  private calculatePaymentSummary(fiatResults: PaymentResult[]): PaymentSummary {
    return {
      fiatSuccess: fiatResults.filter((r) => r.success).length,
      fiatFailed: fiatResults.filter((r) => !r.success).length,
    };
  }
  private async updatePayrollRunStatus(
    payrollRun: PayrollRun,
    summary: PaymentSummary,
    auditContext: AuditContext,
  ): Promise<void> {
    const totalSuccess = summary.fiatSuccess;
    const totalFailed = summary.fiatFailed;
    const _totalItems = totalSuccess + totalFailed;
    if (totalFailed === 0) {
      payrollRun.status = PayrollStatus.COMPLETED;
      payrollRun.processedAt = new Date();
    } else if (totalSuccess === 0) {
      payrollRun.status = PayrollStatus.FAILED;
    } else {
      payrollRun.status = PayrollStatus.PROCESSING;
    }
    await this.payrollRunRepository.save(payrollRun);
  }
  private async resetItemsForRetry(items: PayrollItem[]): Promise<void> {
    for (const item of items) {
      await this.payrollItemRepository.update(item.id, {
        status: PayrollItemStatus.PENDING,
        failureReason: null,
        transactionId: null,
        paymentProvider: null,
        paidAt: null,
      });
    }
  }
  private async getPaymentTypeBreakdown(items: PayrollItem[]) {
    const breakdown = {
      fiat: { total: 0, paid: 0, failed: 0, pending: 0 },
    };
    for (const item of items) {
      breakdown.fiat.total++;
      switch (item.status) {
        case PayrollItemStatus.PAID:
          breakdown.fiat.paid++;
          break;
        case PayrollItemStatus.FAILED:
          breakdown.fiat.failed++;
          break;
        case PayrollItemStatus.PENDING:
        case PayrollItemStatus.PROCESSING:
          breakdown.fiat.pending++;
          break;
      }
    }
    return breakdown;
  }
}
