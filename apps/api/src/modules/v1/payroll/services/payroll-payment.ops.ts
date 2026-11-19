import { Injectable } from '@nestjs/common';

import { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import { ProcessPayrollWithAudit } from '../../../../common/interfaces/process-payroll-dto.interface';
import { PayrollAdjustmentDto, PayrollCalculationPreviewDto } from '../dto/payroll-adjustment.dto';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayrollPaymentOrchestrator } from './payroll-payment-orchestrator';

@Injectable()
export class PayrollPaymentOps {
  constructor(
    private readonly payrollPaymentOrchestrator: PayrollPaymentOrchestrator,
    private readonly payrollCalculationService: PayrollCalculationService,
  ) {}

  // --- Payment delegation ---
  async getPayrollReadiness(payrollRunId: string, tenantId: string) {
    return this.payrollPaymentOrchestrator.getPayrollReadiness(payrollRunId, tenantId);
  }

  async approvePayroll(payrollRunId: string, tenantId: string, auditContext: AuditContext) {
    return this.payrollPaymentOrchestrator.approvePayroll(payrollRunId, tenantId, auditContext);
  }

  async processPayroll(dto: ProcessPayrollWithAudit) {
    return this.payrollPaymentOrchestrator.processPayroll(dto);
  }

  async payNowPayroll(payrollRunId: string, tenantId: string, auditContext: AuditContext) {
    return this.payrollPaymentOrchestrator.payNowPayroll(payrollRunId, tenantId, auditContext);
  }

  async schedulePayrollPayout(
    payrollRunId: string,
    tenantId: string,
    paymentDate?: Date,
    auditContext?: AuditContext,
  ) {
    return this.payrollPaymentOrchestrator.schedulePayrollPayout(
      payrollRunId,
      tenantId,
      paymentDate,
      auditContext,
    );
  }

  async rollbackScheduledPayroll(payrollRunId: string, tenantId: string) {
    return this.payrollPaymentOrchestrator.rollbackScheduledPayroll(payrollRunId, tenantId);
  }

  async processDueScheduledPayouts() {
    return this.payrollPaymentOrchestrator.processDueScheduledPayouts();
  }

  async disburseManualPayroll(dto: ProcessPayrollWithAudit & { confirmed: boolean }) {
    return this.payrollPaymentOrchestrator.disburseManualPayroll(dto);
  }

  async exportBankFile(payrollRunId: string, tenantId: string, auditContext: AuditContext) {
    return this.payrollPaymentOrchestrator.exportBankFile(payrollRunId, tenantId, auditContext);
  }

  // --- Calculation delegation ---
  async calculatePayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
    adjustments?: PayrollAdjustmentDto[],
  ) {
    return this.payrollCalculationService.calculatePayroll(payrollRunId, tenantId, adjustments);
  }

  async previewPayrollCalculation(
    tenantId: string,
    previewDto: PayrollCalculationPreviewDto,
    performedById: string,
  ) {
    return this.payrollCalculationService.previewPayrollCalculation(tenantId, previewDto);
  }

  async getWorkspaceSetupSummary(tenantId: string) {
    return this.payrollCalculationService.getWorkspaceSetupSummary(tenantId);
  }
}
