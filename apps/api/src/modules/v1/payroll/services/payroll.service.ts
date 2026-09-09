import { BadRequestException, ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import type { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import type { ProcessPayrollWithAudit } from '../../../../common/interfaces/process-payroll-dto.interface';
import { ProductAnalyticsService } from '../../../../common/observability/product-analytics.service';
import { ManagerAccessService } from '../../../../common/services/manager-access.service';
import { PaymentProviderFactoryService } from '../../../../common/services/payment-provider-factory.service';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import type { CreatePayrollRunDto } from '../dto/create-payroll-run.dto';
import type { PatchPayrollRunDto } from '../dto/patch-payroll-run.dto';
import type {
  PayrollAdjustmentDto,
  PayrollCalculationPreviewDto,
} from '../dto/payroll-adjustment.dto';
import type { UpdatePayrollItemDto } from '../dto/update-payroll-item.dto';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { AuditService } from './audit.service';
import { MultiPaymentService } from './multi-payment.service';
import { PayrollAccessGuard } from './payroll-access-guard';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayrollExportService } from './payroll-export.service';
import { PayrollPaymentOrchestrator } from './payroll-payment-orchestrator';
import { PayrollRunService } from './payroll-run.service';

@Injectable()
export class PayrollService {
  constructor(
    private readonly payrollRunService: PayrollRunService,
    private readonly payrollPaymentOrchestrator: PayrollPaymentOrchestrator,
    private readonly accessGuard: PayrollAccessGuard,
    private readonly payrollCalculationService: PayrollCalculationService,
    readonly _auditService: AuditService,
    private readonly payrollExportService: PayrollExportService,
    readonly _multiPaymentService: MultiPaymentService,
    readonly _managerAccessService: ManagerAccessService,
    readonly _productAnalytics: ProductAnalyticsService,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly tenantMembersService: TenantMembersService,
    @Optional() readonly _paymentProviderFactory?: PaymentProviderFactoryService,
    @Optional() readonly _notificationHelper?: NotificationHelperService,
  ) {}

  private async assertEmployeesPaymentReady(
    tenantId: string,
    employeeIds: string[],
    currency: string,
  ): Promise<void> {
    const results = await this.paymentMethodService.assessBulkPayrollReadiness(
      tenantId,
      employeeIds,
      currency,
    );
    const notReady = results.filter((r) => !r.ready);
    if (notReady.length > 0) {
      throw new BadRequestException(
        `${notReady.length} employee(s) are missing payment details for ${currency.toUpperCase()} and cannot be included.`,
      );
    }
  }

  // --- CRUD delegation ---
  async createPayrollRun(
    dto: CreatePayrollRunDto,
    tenantId: string,
    createdById: string,
    idempotencyKey?: string,
  ) {
    await this.assertEmployeesPaymentReady(tenantId, dto.employeeIds, dto.baseCurrency);
    return this.payrollRunService.createPayrollRun(dto, tenantId, createdById, idempotencyKey);
  }

  isPayrollAdmin(requesterRole: string): boolean {
    return this.accessGuard.isPayrollAdmin(requesterRole);
  }

  async getPayrollRun(id: string, tenantId: string): Promise<PayrollRun | null> {
    return this.payrollRunService.getPayrollRun(id, tenantId);
  }

  async getPayrollRuns(tenantId: string, limit = 20, offset = 0) {
    return this.payrollRunService.getPayrollRuns(tenantId, limit, offset);
  }

  async getPayrollRunsForRequester(
    tenantId: string,
    limit: number,
    offset: number,
    requesterMemberId: string,
    requesterRole: string,
  ) {
    return this.payrollRunService.getPayrollRunsForRequester(
      tenantId,
      limit,
      offset,
      requesterMemberId,
      requesterRole,
    );
  }

  async getPayrollRunForRequester(
    id: string,
    tenantId: string,
    requesterMemberId: string,
    requesterRole: string,
  ) {
    return this.payrollRunService.getPayrollRunForRequester(
      id,
      tenantId,
      requesterMemberId,
      requesterRole,
    );
  }

  async updatePayrollRun(
    payrollRunId: string,
    tenantId: string,
    dto: PatchPayrollRunDto,
    auditContext: AuditContext,
  ) {
    const structuralChange =
      dto.frequency !== undefined ||
      dto.periodStart !== undefined ||
      dto.periodEnd !== undefined ||
      dto.paymentDate !== undefined ||
      dto.employeeIds !== undefined;

    if (dto.employeeIds?.length) {
      const existing = await this.payrollRunService.getPayrollRun(payrollRunId, tenantId);
      if (!existing) throw new BadRequestException('Payroll run not found');
      await this.assertEmployeesPaymentReady(tenantId, dto.employeeIds, existing.baseCurrency);
    }

    const run = await this.payrollRunService.updatePayrollRun(
      payrollRunId,
      tenantId,
      dto,
      auditContext,
    );

    if (structuralChange) {
      await this.payrollCalculationService.calculatePayroll(payrollRunId, tenantId);
      return this.payrollRunService.getPayrollRun(payrollRunId, tenantId);
    }

    return run;
  }

  async deletePayrollRun(payrollRunId: string, tenantId: string, auditContext: AuditContext) {
    return this.payrollRunService.deletePayrollRun(payrollRunId, tenantId, auditContext);
  }

  async reopenPayrollRun(payrollRunId: string, tenantId: string, auditContext: AuditContext) {
    return this.payrollRunService.reopenPayrollRun(payrollRunId, tenantId, auditContext);
  }

  async removePayrollItem(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
    auditContext: AuditContext,
  ) {
    return this.payrollRunService.removePayrollItem(payrollRunId, itemId, tenantId, auditContext);
  }

  async updatePayrollItem(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
    dto: UpdatePayrollItemDto,
    auditContext: AuditContext,
  ) {
    return this.payrollRunService.updatePayrollItem(
      payrollRunId,
      itemId,
      tenantId,
      dto,
      auditContext,
    );
  }

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

  async schedulePayrollPayout(payrollRunId: string, tenantId: string, paymentDate?: Date) {
    return this.payrollPaymentOrchestrator.schedulePayrollPayout(
      payrollRunId,
      tenantId,
      paymentDate,
    );
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

  // --- Payslip methods ---
  async getRunPayslips(payrollRunId: string, tenantId: string) {
    return this.payrollRunService.getRunPayslips(payrollRunId, tenantId);
  }

  async publishPayslips(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
    itemIds?: string[],
    sendEmail?: boolean,
    requesterMemberId?: string,
    requesterRole?: string,
  ) {
    return this.payrollRunService.publishPayslips(
      payrollRunId,
      tenantId,
      auditContext,
      itemIds,
      sendEmail,
      requesterMemberId,
      requesterRole,
    );
  }

  async notifyEmployeePaymentSetup(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
    requesterMemberId?: string,
    requesterRole?: string,
  ) {
    const result = await this.payrollRunService.notifyEmployeePaymentSetup(
      payrollRunId,
      itemId,
      tenantId,
      requesterMemberId,
      requesterRole,
    );
    const run = await this.payrollRunService.getPayrollRun(payrollRunId, tenantId);
    const item = run?.items?.find((entry) => entry.id === itemId);
    const employee = item?.employee;
    if (employee?.userId && this._notificationHelper) {
      const employeeName =
        `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() || 'there';
      await this._notificationHelper.sendPayrollPaymentSetupReminder(employee.userId, tenantId, {
        employeeName,
        payrollPeriod: `${run?.periodStart ?? ''} – ${run?.periodEnd ?? ''}`,
        message: 'please add your payment details so you can be included in payroll.',
      });
    }
    return result;
  }

  async notifyMemberPaymentSetup(tenantId: string, memberId: string, requesterRole: string) {
    if (!this.isPayrollAdmin(requesterRole)) {
      throw new ForbiddenException('Admin access required');
    }
    const member = await this.tenantMembersService.getTenantMember(memberId, tenantId);
    if (!member.userId) {
      throw new BadRequestException('Employee not found for notification');
    }
    const employeeName = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim() || 'there';
    if (this._notificationHelper) {
      await this._notificationHelper.sendPayrollPaymentSetupReminder(member.userId, tenantId, {
        employeeName,
        payrollPeriod: 'upcoming payroll',
        message: 'please add your payment details so you can be included in payroll.',
      });
    }
    return { notified: true, memberId };
  }

  async getPayslipHtml(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
    requesterMemberId: string,
    requesterRole: string,
  ) {
    const run = await this.payrollExportService.getPayrollRunForExport(payrollRunId, tenantId);
    const item = run.items?.find((e) => e.id === itemId);
    if (!item) throw new BadRequestException('Item not found');
    if (item.status !== PayrollItemStatus.PAID)
      throw new BadRequestException('Only available for paid items');
    await this.assertPayslipAccess(tenantId, item, requesterMemberId, requesterRole);
    return this.payrollExportService.renderPayslipHtml(run, item);
  }

  async getPayslipPdf(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
    requesterMemberId: string,
    requesterRole: string,
  ) {
    const run = await this.payrollExportService.getPayrollRunForExport(payrollRunId, tenantId);
    const item = run.items?.find((e) => e.id === itemId);
    if (!item) throw new BadRequestException('Item not found');
    if (item.status !== PayrollItemStatus.PAID)
      throw new BadRequestException('Only available for paid items');
    await this.assertPayslipAccess(tenantId, item, requesterMemberId, requesterRole);
    return this.payrollExportService.renderPayslipPdf(run, item);
  }

  private async assertPayslipAccess(
    tenantId: string,
    item: { memberId: string; metadata?: { payslipPublished?: unknown } | null },
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<void> {
    await this.accessGuard.assertPayrollMemberAccess(
      tenantId,
      item.memberId,
      requesterMemberId,
      requesterRole,
    );
    if (this.accessGuard.isPayrollAdmin(requesterRole)) return;
    if (item.memberId === requesterMemberId && !item.metadata?.payslipPublished) {
      throw new ForbiddenException('This payslip is not available yet');
    }
  }

  async getMemberPublishedPayslips(
    memberId: string,
    tenantId: string,
    requesterMemberId: string,
    requesterRole: string,
  ) {
    await this.accessGuard.assertPayrollMemberAccess(
      tenantId,
      memberId,
      requesterMemberId,
      requesterRole,
    );
    const items = await this.payrollItemRepository.find({
      where: { memberId, status: PayrollItemStatus.PAID },
      relations: ['payrollRun', 'employee'],
      order: { paidAt: 'DESC' },
    });
    return items
      .filter((i) => i.payrollRun?.tenantId === tenantId && Boolean(i.metadata?.payslipPublished))
      .map((i) => ({
        itemId: i.id,
        runId: i.payrollRunId,
        memberId: i.memberId,
        employeeName: i.employee
          ? `${i.employee.firstName ?? ''} ${i.employee.lastName ?? ''}`.trim() || 'Unknown'
          : i.memberId,
        runTitle: i.payrollRun?.title,
        periodStart: i.payrollRun?.periodStart,
        periodEnd: i.payrollRun?.periodEnd,
        netAmount: i.netAmount,
        currency: i.payrollRun?.baseCurrency,
        paidAt: i.paidAt,
        publishedAt: i.metadata?.payslipPublishedAt as string | undefined,
      }));
  }
}
