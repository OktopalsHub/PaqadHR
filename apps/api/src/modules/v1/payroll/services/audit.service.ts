import { Injectable, Logger } from '@nestjs/common';
import { AuditEventType } from '../../../../common/enums/audit-event-type.enum';
import type { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import type { AuditLogEntry } from '../../../../common/interfaces/audit-log-entry.interface';
import type { TenantActivity } from '../../activities/entities/tenant-activity.entity';
import { ActivitiesService } from '../../activities/services/activities.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly activitiesService: ActivitiesService) {}

  async logEvent(context: AuditContext, entry: AuditLogEntry): Promise<void> {
    if (!context.tenantId) {
      this.logger.warn(`Skipping activity log (missing tenantId): ${entry.eventType}`);
      return;
    }

    await this.activitiesService.queueActivity({
      tenantId: context.tenantId,
      actorMemberId: context.performedById ?? null,
      action: entry.eventType,
      resourceType: 'payroll',
      resourceId: context.payrollRunId ?? null,
      description: entry.description,
      status: entry.eventType.includes('failed') ? 'FAILED' : 'SUCCESS',
      severity: entry.eventType.includes('failed') ? 'HIGH' : 'LOW',
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      metadata: {
        ...(entry.metadata ?? {}),
        memberId: context.memberId ?? null,
        sessionId: context.sessionId ?? null,
        beforeData: entry.beforeData ?? null,
        afterData: entry.afterData ?? null,
      },
    });
  }

  async logPayrollCreated(
    context: AuditContext,
    payrollRunData: Record<string, unknown>,
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: AuditEventType.PAYROLL_CREATED,
      description: `Payroll run created: ${payrollRunData.title}`,
      afterData: payrollRunData,
      metadata: {
        frequency: payrollRunData.frequency,
        employeeCount: payrollRunData.employeeCount,
        baseCurrency: payrollRunData.baseCurrency,
      },
    });
  }

  async logPayrollApproved(
    context: AuditContext,
    payrollRunData: Record<string, unknown>,
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: AuditEventType.PAYROLL_APPROVED,
      description: `Payroll run approved: ${payrollRunData.title}`,
      beforeData: { status: 'processing' },
      afterData: { status: 'approved', ...payrollRunData },
      metadata: {
        totalNetAmount: payrollRunData.totalNetAmount,
        employeeCount: payrollRunData.employeeCount,
        approvedAt: new Date().toISOString(),
      },
    });
  }

  async logManualDisbursement(
    context: AuditContext,
    results: Record<string, unknown>,
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: AuditEventType.PAYROLL_DISBURSED_MANUAL,
      description: `Payroll manually disbursed: ${results.title}`,
      beforeData: { status: 'approved' },
      afterData: {
        status: Number(results.failedCount) > 0 ? 'completed_with_failures' : 'completed',
        ...results,
      },
      metadata: {
        paidCount: results.paidCount,
        failedCount: results.failedCount,
        disbursementMode: 'manual',
        processingDuration: results.processingDuration,
      },
    });
  }

  async logPayrollExported(
    context: AuditContext,
    exportData: Record<string, unknown>,
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: AuditEventType.PAYROLL_EXPORTED,
      description: `Payroll export generated: ${exportData.exportType}`,
      afterData: exportData,
      metadata: {
        exportType: exportData.exportType,
        rowCount: exportData.rowCount,
        exportedAt: new Date().toISOString(),
      },
    });
  }

  async logPayslipsPublished(
    context: AuditContext,
    data: {
      itemIds: string[];
      documentIds: string[];
      sendEmail: boolean;
      publishedCount: number;
    },
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: AuditEventType.PAYSLIPS_PUBLISHED,
      description: `Published ${data.publishedCount} payslip(s) to employees`,
      afterData: data,
      metadata: {
        itemIds: data.itemIds,
        documentIds: data.documentIds,
        sendEmail: data.sendEmail,
        publishedAt: new Date().toISOString(),
      },
    });
  }

  async logPayrollProcessed(
    context: AuditContext,
    payrollRunData: Record<string, unknown>,
    processingResults: Record<string, unknown>,
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: AuditEventType.PAYROLL_PROCESSED,
      description: `Payroll run processed: ${payrollRunData.title}`,
      beforeData: { status: 'draft' },
      afterData: { status: 'completed', ...processingResults },
      metadata: {
        totalGrossAmount: payrollRunData.totalGrossAmount,
        totalNetAmount: payrollRunData.totalNetAmount,
        employeeCount: payrollRunData.employeeCount,
        processingDuration: processingResults.processingDuration,
      },
    });
  }

  async logPaymentSent(context: AuditContext, paymentData: Record<string, unknown>): Promise<void> {
    await this.logEvent(context, {
      eventType: AuditEventType.PAYMENT_SENT,
      description: `Payment sent to employee ${context.memberId}`,
      afterData: paymentData,
      metadata: {
        amount: paymentData.paymentAmount,
        currency: paymentData.paymentCurrency,
        provider: paymentData.paymentProvider,
        transactionId: paymentData.transactionId,
      },
    });
  }

  async logPaymentFailed(
    context: AuditContext,
    paymentData: Record<string, unknown>,
    failureReason: string,
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: AuditEventType.PAYMENT_FAILED,
      description: `Payment failed for employee ${context.memberId}: ${failureReason}`,
      afterData: paymentData,
      metadata: {
        amount: paymentData.paymentAmount,
        currency: paymentData.paymentCurrency,
        provider: paymentData.paymentProvider,
        failureReason,
      },
    });
  }

  async logTaxCalculated(context: AuditContext, taxData: Record<string, unknown>): Promise<void> {
    await this.logEvent(context, {
      eventType: AuditEventType.TAX_CALCULATED,
      description: `Tax calculated for employee ${context.memberId}`,
      afterData: taxData,
      metadata: {
        incomeTax: taxData.incomeTax,
        socialSecurityTax: taxData.socialSecurityTax,
        otherTaxes: taxData.otherTaxes,
        taxJurisdiction: taxData.taxJurisdiction,
      },
    });
  }

  async logComplianceCheck(
    context: AuditContext,
    complianceResults: Record<string, unknown>,
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: AuditEventType.COMPLIANCE_CHECK,
      description: `Compliance check completed: ${complianceResults.overallStatus}`,
      afterData: complianceResults,
      metadata: {
        totalViolations: complianceResults.totalViolations,
        criticalViolations: complianceResults.criticalViolations,
        overallStatus: complianceResults.overallStatus,
      },
    });
  }

  async logPaymentAttempt(
    context: AuditContext,
    paymentData: Record<string, unknown>,
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: AuditEventType.PAYMENT_SENT,
      description: `Payment attempt for employee ${context.memberId}`,
      afterData: paymentData,
      metadata: {
        paymentAmount: paymentData.paymentAmount,
        paymentCurrency: paymentData.paymentCurrency,
        paymentMethodType: paymentData.paymentMethodType,
        attemptedAt: new Date().toISOString(),
      },
    });
  }

  async logLargePaymentDetected(
    context: AuditContext,
    paymentData: Record<string, unknown>,
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: AuditEventType.PAYMENT_SENT,
      description: `Large payment detected for employee ${context.memberId}`,
      afterData: paymentData,
      metadata: {
        paymentAmount: paymentData.paymentAmount,
        paymentCurrency: paymentData.paymentCurrency,
        threshold: paymentData.threshold,
        flaggedAt: new Date().toISOString(),
        requiresReview: true,
      },
    });
  }

  async logSalaryCalculated(
    context: AuditContext,
    salaryData: Record<string, unknown>,
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: AuditEventType.TAX_CALCULATED,
      description: `Salary calculated for employee ${context.memberId}`,
      afterData: salaryData,
      metadata: {
        baseSalary: salaryData.baseSalary,
        totalAdjustments: salaryData.totalAdjustments,
        finalAmount: salaryData.finalAmount,
        adjustmentCount: salaryData.adjustmentCount,
        currency: salaryData.currency,
        payType: salaryData.payType,
        paySchedule: salaryData.paySchedule,
      },
    });
  }

  async logAdjustmentCalculated(
    context: AuditContext,
    adjustmentData: Record<string, unknown>,
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: AuditEventType.TAX_CALCULATED,
      description: `Payroll adjustment calculated for employee ${context.memberId}`,
      afterData: adjustmentData,
      metadata: {
        type: adjustmentData.type,
        method: adjustmentData.method,
        originalValue: adjustmentData.originalValue,
        calculatedAmount: adjustmentData.calculatedAmount,
        reason: adjustmentData.reason,
        baseSalary: adjustmentData.baseSalary,
      },
    });
  }

  async logPayrollAdjustmentSummary(
    context: AuditContext,
    summaryData: Record<string, unknown>,
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: AuditEventType.PAYROLL_PROCESSED,
      description: `Payroll adjustment summary for payroll run ${context.payrollRunId}`,
      afterData: summaryData,
      metadata: {
        totalEmployees: summaryData.totalEmployees,
        totalBaseSalary: summaryData.totalBaseSalary,
        totalAdjustments: summaryData.totalAdjustments,
        totalFinalAmount: summaryData.totalFinalAmount,
        adjustmentsByType: summaryData.adjustmentsByType,
      },
    });
  }

  async getAuditTrail(payrollRunId: string, tenantId: string): Promise<TenantActivity[]> {
    return this.activitiesService.listForResource(tenantId, 'payroll', payrollRunId, 100);
  }

  async generateAuditReport(
    payrollRunId: string,
    tenantId: string,
  ): Promise<{
    payrollRunId: string;
    totalEvents: number;
    eventsByType: Record<string, number>;
    timeline: TenantActivity[];
    generatedAt: Date;
  }> {
    const activities = await this.getAuditTrail(payrollRunId, tenantId);
    const eventsByType: Record<string, number> = {};
    for (const log of activities) {
      eventsByType[log.action] = (eventsByType[log.action] || 0) + 1;
    }
    return {
      payrollRunId,
      totalEvents: activities.length,
      eventsByType,
      timeline: activities,
      generatedAt: new Date(),
    };
  }
}
