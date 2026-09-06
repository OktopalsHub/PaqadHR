import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import type { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import type { ProcessPayrollWithAudit } from '../../../../common/interfaces/process-payroll-dto.interface';
import { ProductAnalyticsService } from '../../../../common/observability/product-analytics.service';
import { ManagerAccessService } from '../../../../common/services/manager-access.service';
import { PaymentProviderFactoryService } from '../../../../common/services/payment-provider-factory.service';
import { EmploymentService } from '../../employment/employment.service';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { TenantsService } from '../../tenants/tenants.service';
import type { CreatePayrollRunDto } from '../dto/create-payroll-run.dto';
import type { PatchPayrollRunDto } from '../dto/patch-payroll-run.dto';
import type { UpdatePayrollItemDto } from '../dto/update-payroll-item.dto';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { AuditService } from './audit.service';
import { MultiPaymentService } from './multi-payment.service';
import { PayrollAccessGuard } from './payroll-access-guard';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayrollExportService } from './payroll-export.service';
import { PayrollPaymentOrchestrator } from './payroll-payment-orchestrator';
import { PayrollRunService } from './payroll-run.service';

interface PayrollPreviewEmployee {
  employeeId: string;
  adjustments?: any[];
}
interface PayrollPreviewDto {
  employees: PayrollPreviewEmployee[];
}
export interface PayrollPreviewResult {
  employeeId: string;
  baseSalary: number;
  currency: string;
  payType: string;
  paySchedule: string;
  finalAmount: number;
  adjustments: any[];
}

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly payrollRunService: PayrollRunService,
    private readonly payrollPaymentOrchestrator: PayrollPaymentOrchestrator,
    private readonly accessGuard: PayrollAccessGuard,
    readonly _payrollCalculationService: PayrollCalculationService,
    readonly _auditService: AuditService,
    private readonly employmentService: EmploymentService,
    private readonly tenantMembersService: TenantMembersService,
    readonly _tenantSettingsService: TenantSettingsService,
    readonly _tenantsService: TenantsService,
    private readonly payrollExportService: PayrollExportService,
    readonly _multiPaymentService: MultiPaymentService,
    private readonly paymentMethodService: PaymentMethodService,
    readonly _managerAccessService: ManagerAccessService,
    readonly _productAnalytics: ProductAnalyticsService,
    @Optional() readonly _paymentProviderFactory?: PaymentProviderFactoryService,
    @Optional() readonly _notificationHelper?: NotificationHelperService,
  ) {}

  isPayrollAdmin(requesterRole: string): boolean {
    return this.accessGuard.isPayrollAdmin(requesterRole);
  }

  // --- CRUD delegation ---
  async createPayrollRun(
    dto: CreatePayrollRunDto,
    tenantId: string,
    createdById: string,
    idempotencyKey?: string,
  ) {
    return this.payrollRunService.createPayrollRun(dto, tenantId, createdById, idempotencyKey);
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
    return this.payrollRunService.updatePayrollRun(payrollRunId, tenantId, dto, auditContext);
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

  // --- Calculation (owned) ---
  async calculatePayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
    adjustments?: any[],
  ) {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items', 'items.employee'],
    });
    if (!run) throw new BadRequestException('Payroll run not found');

    const items = (run.items ?? []).filter((i) => i.status !== PayrollItemStatus.CANCELLED);
    if (items.length === 0) throw new BadRequestException('No active items');

    run.status = PayrollStatus.PROCESSING;
    await this.payrollRunRepository.save(run);

    for (const item of items) {
      try {
        const salaryInfo = await this.employmentService.getEmploymentSalaryInfo(
          item.memberId,
          tenantId,
        );
        item.baseSalary = salaryInfo.baseSalary;
        item.baseSalaryCurrency = salaryInfo.currency;
        item.grossAmount = salaryInfo.baseSalary;
        item.netAmount = salaryInfo.baseSalary;
        item.metadata = {
          ...item.metadata,
          payType: salaryInfo.payType,
          paySchedule: salaryInfo.paySchedule,
        };
        await this.payrollItemRepository.save(item);
      } catch (error) {
        this.logger.error(`Calculation failed for ${item.memberId}: ${error}`);
      }
    }

    run.totalGrossAmount = items.reduce((s, i) => s + Number(i.grossAmount ?? 0), 0);
    run.totalNetAmount = items.reduce((s, i) => s + Number(i.netAmount ?? 0), 0);
    run.totalDeductions = items.reduce((s, i) => s + Number(i.deductions ?? 0), 0);
    await this.payrollRunRepository.save(run);
    return {
      warnings: [],
      readiness: await this.payrollPaymentOrchestrator.getPayrollReadiness(payrollRunId, tenantId),
    };
  }

  async previewPayrollCalculation(
    tenantId: string,
    previewDto: PayrollPreviewDto,
    performedById: string,
  ) {
    const warnings: string[] = [];
    const results: PayrollPreviewResult[] = [];
    for (const emp of previewDto.employees) {
      try {
        const salaryInfo = await this.employmentService.getEmploymentSalaryInfo(
          emp.employeeId,
          tenantId,
        );
        results.push({
          employeeId: emp.employeeId,
          baseSalary: salaryInfo.baseSalary,
          currency: salaryInfo.currency,
          payType: salaryInfo.payType,
          paySchedule: salaryInfo.paySchedule,
          finalAmount: salaryInfo.baseSalary,
          adjustments: emp.adjustments || [],
        });
      } catch (error) {
        this.logger.error(`Preview failed for ${emp.employeeId}: ${error}`);
        warnings.push(`Calculation failed for ${emp.employeeId}`);
      }
    }
    return {
      employees: results,
      summary: {
        totalEmployees: results.length,
        totalAmount: results.reduce((s, r) => s + r.finalAmount, 0),
        currency: results[0]?.currency || 'USD',
      },
      warnings,
    };
  }

  async getWorkspaceSetupSummary(tenantId: string) {
    const [salaries, members] = await Promise.all([
      this.employmentService.getCurrentSalariesForTenant(tenantId),
      this.tenantMembersService.getTenantMembers(tenantId),
    ]);
    const activeIds = new Set(members.filter((m) => m.isActive).map((m) => m.id));
    const eligible = salaries.filter((s) => activeIds.has(s.memberId));
    const byCurrencyMap = new Map<string, string[]>();
    for (const s of eligible) {
      const c = s.currency.toUpperCase();
      const ids = byCurrencyMap.get(c) ?? [];
      ids.push(s.memberId);
      byCurrencyMap.set(c, ids);
    }
    let paymentReadyCount = 0;
    const byCurrency: Array<{
      currency: string;
      employeeCount: number;
      paymentReadyCount: number;
    }> = [];
    for (const [currency, memberIds] of byCurrencyMap.entries()) {
      const results = await this.paymentMethodService.assessBulkPayrollReadiness(
        tenantId,
        memberIds,
        currency,
      );
      const ready = results.filter((r) => r.ready).length;
      paymentReadyCount += ready;
      byCurrency.push({ currency, employeeCount: memberIds.length, paymentReadyCount: ready });
    }
    byCurrency.sort((a, b) => a.currency.localeCompare(b.currency));
    return { totalEmployees: eligible.length, paymentReadyCount, byCurrency };
  }

  // --- Payslip methods (owned) ---
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
    return this.payrollRunService.notifyEmployeePaymentSetup(
      payrollRunId,
      itemId,
      tenantId,
      requesterMemberId,
      requesterRole,
    );
  }

  async getPayslipHtml(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
    requesterMemberId?: string,
    requesterRole?: string,
  ) {
    const run = await this.payrollExportService.getPayrollRunForExport(payrollRunId, tenantId);
    const item = run.items?.find((e) => e.id === itemId);
    if (!item) throw new BadRequestException('Item not found');
    if (item.status !== PayrollItemStatus.PAID)
      throw new BadRequestException('Only available for paid items');
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
    return this.payrollExportService.renderPayslipPdf(run, item);
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
