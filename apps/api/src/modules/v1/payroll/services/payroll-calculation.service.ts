import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import { FiatExchangeService } from '../../../../common/services/fiat-exchange.service';
import { EmploymentService } from '../../employment/employment.service';
import { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import type {
  PayrollAdjustmentDto,
  PayrollCalculationPreviewDto,
} from '../dto/payroll-adjustment.dto';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import {
  collectAdjustmentsForEmployee,
  computePayrollItemAmounts,
} from '../utils/payroll-adjustment.util';
import { resolvePayrollPayoutConversion } from '../utils/payroll-payout-conversion.util';
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
    private readonly fiatExchange: FiatExchangeService,
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
        const payoutMethod = await this.paymentMethodService.findPrimaryPayoutMethod(
          tenantId,
          item.memberId,
        );
        if (!payoutMethod?.currency) {
          throw new BadRequestException('Verified primary payout method is required');
        }

        const lines = collectAdjustmentsForEmployee(
          item.memberId,
          adjustments,
          item.metadata ?? undefined,
        );
        const amounts = computePayrollItemAmounts(salaryInfo.baseSalary, lines);
        const salaryCurrency = salaryInfo.currency.toUpperCase();
        const payoutCurrency = payoutMethod.currency.toUpperCase();
        const conversion = await resolvePayrollPayoutConversion(
          amounts.netAmount,
          salaryCurrency,
          payoutCurrency,
          this.fiatExchange,
        );

        item.baseSalary = amounts.baseSalary;
        item.baseSalaryCurrency = salaryCurrency;
        item.grossAmount = amounts.grossAmount;
        item.adjustments = amounts.adjustments;
        item.deductions = amounts.deductions;
        item.netAmount = amounts.netAmount;
        item.paymentCurrency = payoutCurrency;
        item.paymentAmount = conversion.paymentAmount;
        item.exchangeRate = conversion.exchangeRate;
        item.metadata = {
          ...item.metadata,
          payType: salaryInfo.payType,
          paySchedule: salaryInfo.paySchedule,
          adjustmentLines: lines,
          fxAtPayout: conversion.fxAtPayout,
          payoutMethodId: payoutMethod.id,
        };
        await this.payrollItemRepository.save(item);
      } catch (error) {
        this.logger.error(`Calculation failed for ${item.memberId}: ${error}`);
        warnings.push(
          error instanceof Error
            ? `${item.memberId}: ${error.message}`
            : `Calculation failed for member ${item.memberId}`,
        );
      }
    }

    if (warnings.length > 0) {
      throw new BadRequestException(
        `Calculation failed for ${warnings.length} employee(s). ${warnings.join(' ')}`,
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
        const lines = emp.adjustments || [];
        const amounts = computePayrollItemAmounts(salaryInfo.baseSalary, lines);
        results.push({
          employeeId: emp.employeeId,
          baseSalary: amounts.baseSalary,
          currency: salaryInfo.currency,
          payType: salaryInfo.payType,
          paySchedule: salaryInfo.paySchedule,
          finalAmount: amounts.netAmount,
          adjustments: lines,
        });
      } catch (error) {
        this.logger.error(`Preview failed for ${emp.employeeId}: ${error}`);
        warnings.push(
          error instanceof Error
            ? `${emp.employeeId}: ${error.message}`
            : `Calculation failed for ${emp.employeeId}`,
        );
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
    const eligible = salaries.filter((s) => activeIds.has(s.memberId) && Number(s.payRate) > 0);
    const eligibleMemberIds = eligible.map((s) => s.memberId);

    const readinessResults = await this.paymentMethodService.assessBulkPayrollReadiness(
      tenantId,
      eligibleMemberIds,
    );
    const readySet = new Set(
      readinessResults.filter((result) => result.ready).map((result) => result.memberId),
    );

    const byCurrencyMap = new Map<string, string[]>();
    for (const salary of eligible) {
      const salaryCurrency = salary.currency.toUpperCase();
      const ids = byCurrencyMap.get(salaryCurrency) ?? [];
      ids.push(salary.memberId);
      byCurrencyMap.set(salaryCurrency, ids);
    }

    const byCurrency: Array<{
      currency: string;
      employeeCount: number;
      paymentReadyCount: number;
      readyMemberIds: string[];
    }> = [];

    for (const [currency, memberIds] of byCurrencyMap.entries()) {
      const readyMemberIds = memberIds.filter((memberId) => readySet.has(memberId));
      byCurrency.push({
        currency,
        employeeCount: memberIds.length,
        paymentReadyCount: readyMemberIds.length,
        readyMemberIds,
      });
    }
    byCurrency.sort((a, b) => a.currency.localeCompare(b.currency));

    return {
      totalEmployees: eligible.length,
      paymentReadyCount: readySet.size,
      readyMemberIds: [...readySet],
      byCurrency,
    };
  }
}
