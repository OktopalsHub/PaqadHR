import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import { EmploymentService } from '../../employment/employment.service';
import { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import type {
  PayrollAdjustmentDto,
  PayrollCalculationPreviewDto,
} from '../dto/payroll-adjustment.dto';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { PayrollPaymentOrchestrator } from './payroll-payment-orchestrator';

export interface PayrollPreviewResult {
  employeeId: string;
  baseSalary: number;
  currency: string;
  payType: string;
  paySchedule: string;
  finalAmount: number;
  adjustments: PayrollAdjustmentDto[];
}

@Injectable()
export class PayrollCalculationService {
  private readonly logger = new Logger(PayrollCalculationService.name);

  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly employmentService: EmploymentService,
    private readonly tenantMembersService: TenantMembersService,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly payrollPaymentOrchestrator: PayrollPaymentOrchestrator,
  ) {}

  async calculatePayroll(
    payrollRunId: string,
    tenantId: string,
    adjustments?: PayrollAdjustmentDto[],
  ) {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items', 'items.employee'],
    });
    if (!run) throw new BadRequestException('Payroll run not found');

    const items = (run.items ?? []).filter((i) => i.status !== PayrollItemStatus.CANCELLED);
    if (items.length === 0) throw new BadRequestException('No active items');

    const warnings: string[] = [];
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
        item.paymentCurrency = run.baseCurrency || salaryInfo.currency;
        item.paymentAmount = salaryInfo.baseSalary;
        item.exchangeRate = 1;
        item.metadata = {
          ...item.metadata,
          payType: salaryInfo.payType,
          paySchedule: salaryInfo.paySchedule,
        };
        await this.payrollItemRepository.save(item);
      } catch (error) {
        this.logger.error(`Calculation failed for ${item.memberId}: ${error}`);
        warnings.push(`Calculation failed for member ${item.memberId}`);
      }
    }

    if (warnings.length > 0) {
      throw new BadRequestException(
        `Calculation failed for ${warnings.length} employee(s). Resolve the salary records and retry.`,
      );
    }

    run.status = PayrollStatus.PROCESSING;
    run.totalGrossAmount = items.reduce((s, i) => s + Number(i.grossAmount ?? 0), 0);
    run.totalNetAmount = items.reduce((s, i) => s + Number(i.netAmount ?? 0), 0);
    run.totalDeductions = items.reduce((s, i) => s + Number(i.deductions ?? 0), 0);
    await this.payrollRunRepository.save(run);
    return {
      warnings,
      readiness: await this.payrollPaymentOrchestrator.getPayrollReadiness(payrollRunId, tenantId),
    };
  }

  async previewPayrollCalculation(tenantId: string, previewDto: PayrollCalculationPreviewDto) {
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
    const readyMemberIds: string[] = [];
    const byCurrency: Array<{
      currency: string;
      employeeCount: number;
      paymentReadyCount: number;
      readyMemberIds: string[];
    }> = [];
    for (const [currency, memberIds] of byCurrencyMap.entries()) {
      const results = await this.paymentMethodService.assessBulkPayrollReadiness(
        tenantId,
        memberIds,
        currency,
      );
      const readyIds = results.filter((r) => r.ready).map((r) => r.memberId);
      paymentReadyCount += readyIds.length;
      readyMemberIds.push(...readyIds);
      byCurrency.push({
        currency,
        employeeCount: memberIds.length,
        paymentReadyCount: readyIds.length,
        readyMemberIds: readyIds,
      });
    }
    byCurrency.sort((a, b) => a.currency.localeCompare(b.currency));
    return { totalEmployees: eligible.length, paymentReadyCount, readyMemberIds, byCurrency };
  }
}
