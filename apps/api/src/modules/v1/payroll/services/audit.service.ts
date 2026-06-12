import { AuditEventType } from '../../../../common/enums/audit-event-type.enum';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import { AuditLogEntry } from '../../../../common/interfaces/audit-log-entry.interface';
import { PayrollAuditLog } from '../entities/payroll-audit.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(
    @InjectRepository(PayrollAuditLog)
    private auditLogRepository: Repository<PayrollAuditLog>,
  ) {}
  async logEvent(
    context: AuditContext,
    entry: AuditLogEntry,
  ): Promise<PayrollAuditLog> {
    try {
      const auditLog = this.auditLogRepository.create({
        payrollRunId: context.payrollRunId || null,
        memberId: context.memberId || null,
        performedById: context.performedById || null,
        eventType: entry.eventType,
        description: entry.description,
        beforeData: entry.beforeData || null,
        afterData: entry.afterData || null,
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
        sessionId: context.sessionId || null,
        metadata: entry.metadata || null,
      });
      const savedLog = await this.auditLogRepository.save(auditLog);
      this.logger.log(
        `Audit event logged: ${entry.eventType} - ${entry.description}`,
      );
      return savedLog;
    } catch (error) {
      this.logger.error('Failed to log audit event:', error);
      throw error;
    }
  }
  async logPayrollCreated(
    context: AuditContext,
    payrollRunData: Record<string, any>,
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
  async logPayrollProcessed(
    context: AuditContext,
    payrollRunData: Record<string, any>,
    processingResults: Record<string, any>,
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
  async logPaymentSent(
    context: AuditContext,
    paymentData: Record<string, any>,
  ): Promise<void> {
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
    paymentData: Record<string, any>,
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
  async logTaxCalculated(
    context: AuditContext,
    taxData: Record<string, any>,
  ): Promise<void> {
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
    complianceResults: Record<string, any>,
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
    paymentData: Record<string, any>,
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
    paymentData: Record<string, any>,
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
    salaryData: Record<string, any>,
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
    adjustmentData: Record<string, any>,
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
    summaryData: Record<string, any>,
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
  async getAuditTrail(
    payrollRunId?: string,
    tenantId?: string,
    memberId?: string,
    eventType?: AuditEventType,
    startDate?: Date,
    endDate?: Date,
    limit = 100,
  ): Promise<PayrollAuditLog[]> {
    const query = this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.payrollRun', 'payrollRun')
      .leftJoinAndSelect('audit.employee', 'employee')
      .leftJoinAndSelect('audit.performedBy', 'performedBy')
      .orderBy('audit.createdAt', 'DESC')
      .limit(limit);
    if (payrollRunId) {
      query.andWhere('audit.payrollRunId = :payrollRunId', { payrollRunId });
    }
    if (tenantId) {
      query.andWhere('payrollRun.tenantId = :tenantId', { tenantId });
    }
    if (memberId) {
      query.andWhere('audit.memberId = :memberId', { memberId });
    }
    if (eventType) {
      query.andWhere('audit.eventType = :eventType', { eventType });
    }
    if (startDate) {
      query.andWhere('audit.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('audit.createdAt <= :endDate', { endDate });
    }
    return query.getMany();
  }
  async generateAuditReport(payrollRunId: string): Promise<{
    payrollRunId: string;
    totalEvents: number;
    eventsByType: Record<string, number>;
    timeline: PayrollAuditLog[];
    generatedAt: Date;
  }> {
    const auditLogs = await this.getAuditTrail(
      payrollRunId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      1000,
    );
    const eventsByType: Record<string, number> = {};
    for (const log of auditLogs) {
      eventsByType[log.eventType] = (eventsByType[log.eventType] || 0) + 1;
    }
    return {
      payrollRunId,
      totalEvents: auditLogs.length,
      eventsByType,
      timeline: auditLogs,
      generatedAt: new Date(),
    };
  }
}
