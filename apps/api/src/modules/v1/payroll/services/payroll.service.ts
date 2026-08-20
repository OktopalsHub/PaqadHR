import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollStatus, PayrollItemStatus } from '../enums/payroll.enum';
import type { CreatePayrollRunDto } from '../dto/create-payroll-run.dto';
import type { ProcessPayrollWithAudit } from '../dto/process-payroll.dto';
import type { AuditContext } from '../../audit-logs/entities/audit-log.entity';
import { PayrollRunService } from './payroll-run.service';
import { PayrollApprovalService } from './payroll-approval.service';
import { PayrollPayslipService } from './payroll-payslip.service';
import { PayrollItemService } from './payroll-item.service';
import { PayrollReadinessService } from './payroll-readiness.service';
import { PayrollNotificationService } from './payroll-notification.service';

/**
 * Facade service that delegates to specialized payroll services.
 */
@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private readonly payrollRunService: PayrollRunService,
    private readonly payrollApprovalService: PayrollApprovalService,
    private readonly payrollPayslipService: PayrollPayslipService,
    private readonly payrollItemService: PayrollItemService,
    private readonly payrollReadinessService: PayrollReadinessService,
    private readonly payrollNotificationService: PayrollNotificationService,
    @InjectRepository(PayrollRun)
    private readonly payrollRunRepository: Repository<PayrollRun>,
    @InjectRepository(PayrollItem)
    private readonly payrollItemRepository: Repository<PayrollItem>,
  ) { }

  // ==================== Payroll Run Operations ====================

  async createPayrollRun(
    dto: CreatePayrollRunDto,
    tenantId: string,
    createdById: string,
    idempotencyKey?: string,
  ): Promise<PayrollRun & { alreadyExists?: boolean }> {
    return this.payrollRunService.createPayrollRun(dto, tenantId, createdById, idempotencyKey);
  }

  async calculatePayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
    adjustments?: any[],
  ): Promise<{ warnings: string[]; readiness: any[] }> {
    // TODO: This is complex - may need to be refactored or kept in facade
    throw new Error('calculatePayroll needs refactoring - temporarily in facade');
  }

  // ==================== Approval & Scheduling ====================

  async approvePayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<PayrollRun> {
    return this.payrollApprovalService.approvePayroll(payrollRunId, tenantId, auditContext);
  }

  async schedulePayrollPayout(
    payrollRunId: string,
    scheduledDate: Date,
  ): Promise<void> {
    return this.payrollApprovalService.schedulePayout(payrollRunId, scheduledDate);
  }

  async processDueScheduledPayouts(): Promise<{ processed: number; failed: number }> {
    // TODO: Extract from original payroll.service.ts lines 472-505
    throw new Error('Not implemented - extract from original payroll.service.ts');
  }

  // ==================== Payslip Operations ====================

  async getPayslipHtml(payrollRunId: string, memberId: string): Promise<string> {
    return this.payrollPayslipService.generatePayslipHtml(payrollRunId, memberId);
  }

  async getPayslipPdf(payrollRunId: string, memberId: string): Promise<Buffer> {
    return this.payrollPayslipService.generatePayslipPdf(payrollRunId, memberId);
  }

  async getMemberPublishedPayslips(memberId: string): Promise<any[]> {
    return this.payrollPayslipService.getMemberPayslips(memberId);
  }

  async exportBankFile(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<string> {
    return this.payrollPayslipService.exportBankFile(payrollRunId, tenantId, auditContext);
  }

  // ==================== Payroll Item Operations ====================

  async removePayrollItem(payrollRunId: string, memberId: string): Promise<void> {
    return this.payrollItemService.removePayrollItem(payrollRunId, memberId);
  }

  async updatePayrollItem(
    payrollRunId: string,
    memberId: string,
    updates: any,
  ): Promise<PayrollItem> {
    return this.payrollItemService.updatePayrollItem(payrollRunId, memberId, updates);
  }

  // ==================== Readiness Assessment ====================

  async getPayrollReadiness(payrollRunId: string, tenantId: string): Promise<any> {
    return this.payrollReadinessService.assessPayrollReadiness(payrollRunId, tenantId);
  }

  // ==================== Notification Operations ====================

  async notifyEmployeePaymentSetup(tenantId: string, memberId: string): Promise<void> {
    return this.payrollNotificationService.notifyPaymentSetup(tenantId, memberId);
  }

  // ==================== Utility Methods (keep in facade) ====================

  async getPayrollRunsForRequester(
    tenantId: string,
    requesterRole: string,
    requesterId?: string,
  ): Promise<PayrollRun[]> {
    // Simple filtering logic - keep in facade
    const runs = await this.payrollRunRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });

    if (this.isPayrollAdmin(requesterRole)) {
      return runs;
    }

    // Non-admin only sees their own items
    const filteredRuns = [];
    for (const run of runs) {
      const hasItem = await this.payrollItemRepository.findOne({
        where: { payrollRunId: run.id, memberId: requesterId },
      });
      if (hasItem) {
        filteredRuns.push(run);
      }
    }
    return filteredRuns;
  }

  async getPayrollRunForRequester(
    payrollRunId: string,
    tenantId: string,
    requesterRole: string,
    requesterId?: string,
  ): Promise<PayrollRun | null> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items'],
    });

    if (!run) {
      return null;
    }

    if (this.isPayrollAdmin(requesterRole)) {
      return run;
    }

    // Non-admin must have an item in this run
    const hasItem = run.items?.some(item => item.memberId === requesterId);
    return hasItem ? run : null;
  }

  private isPayrollAdmin(requesterRole: string): boolean {
    return ['ADMIN', 'OWNER', 'PAYROLL_ADMIN'].includes(requesterRole);
  }
}
