import { BadRequestException, Injectable } from '@nestjs/common';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import type { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import { PAYROLL_SECURITY_CONFIG } from '../config/security.config';
import type { PayrollItem } from '../entities/payroll-item.entity';
import type { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { AuditService } from './audit.service';

@Injectable()
export class ManualDisbursementService {
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly auditService: AuditService,
  ) {}

  async disbursePayrollRun(
    payrollRun: PayrollRun,
    auditContext: AuditContext,
    confirmed: boolean,
  ): Promise<{ paidCount: number; failedCount: number }> {
    if (!confirmed) {
      throw new BadRequestException(
        'Offline disbursement requires confirmed: true — confirm salaries were sent outside the system',
      );
    }

    if (payrollRun.status !== PayrollStatus.APPROVED) {
      throw new BadRequestException(
        `Payroll run must be approved before manual disbursement. Current status: ${payrollRun.status}`,
      );
    }

    const startTime = Date.now();
    let paidCount = 0;
    let failedCount = 0;

    for (const item of payrollRun.items ?? []) {
      if (item.status === PayrollItemStatus.CANCELLED) {
        continue;
      }
      try {
        await this.markItemPaidManually(item, payrollRun.tenantId, auditContext);
        paidCount++;
      } catch (error) {
        failedCount++;
        const message = error instanceof Error ? error.message : 'Manual disbursement failed';
        item.status = PayrollItemStatus.FAILED;
        item.failureReason = message;
        await this.payrollItemRepository.save(item);
        await this.auditService.logPaymentFailed(
          { ...auditContext, memberId: item.memberId },
          {
            paymentAmount: item.paymentAmount,
            paymentCurrency: item.paymentCurrency,
            paymentProvider: 'manual',
          },
          message,
        );
      }
    }

    payrollRun.status =
      failedCount > 0 && paidCount === 0 ? PayrollStatus.FAILED : PayrollStatus.COMPLETED;
    payrollRun.processedAt = new Date();
    payrollRun.metadata = {
      ...payrollRun.metadata,
      disbursementMode: 'manual',
      disbursedAt: new Date().toISOString(),
      disbursedBy: auditContext.performedById,
      paidCount,
      failedCount,
    };
    await this.payrollRunRepository.save(payrollRun);

    const processingDuration = Date.now() - startTime;
    await this.auditService.logManualDisbursement(auditContext, {
      title: payrollRun.title,
      totalNetAmount: payrollRun.totalNetAmount,
      employeeCount: payrollRun.employeeCount,
      paidCount,
      failedCount,
      processingDuration,
    });

    return { paidCount, failedCount };
  }

  private async markItemPaidManually(
    payrollItem: PayrollItem,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<void> {
    if (!payrollItem.paymentAmount || payrollItem.paymentAmount <= 0) {
      throw new BadRequestException(`Invalid payment amount for employee ${payrollItem.memberId}`);
    }

    if (payrollItem.paymentAmount > PAYROLL_SECURITY_CONFIG.MAX_PAYMENT_LIMIT) {
      throw new BadRequestException(
        `Payment amount exceeds maximum limit for employee ${payrollItem.memberId}`,
      );
    }

    if (payrollItem.paymentAmount >= PAYROLL_SECURITY_CONFIG.LARGE_PAYMENT_THRESHOLD) {
      await this.auditService.logLargePaymentDetected(
        { ...auditContext, memberId: payrollItem.memberId },
        {
          paymentAmount: payrollItem.paymentAmount,
          paymentCurrency: payrollItem.paymentCurrency,
          threshold: PAYROLL_SECURITY_CONFIG.LARGE_PAYMENT_THRESHOLD,
        },
      );
    }

    payrollItem.status = PayrollItemStatus.PAID;
    payrollItem.transactionId = null;
    payrollItem.paymentProvider = 'manual';
    payrollItem.paidAt = new Date();
    payrollItem.failureReason = null;
    await this.payrollItemRepository.save(payrollItem);

    await this.auditService.logPaymentSent(
      { ...auditContext, memberId: payrollItem.memberId },
      {
        paymentAmount: payrollItem.paymentAmount,
        paymentCurrency: payrollItem.paymentCurrency,
        paymentProvider: 'manual',
        transactionId: null,
        disbursementMode: 'manual',
      },
    );
  }
}
