import { BadRequestException, Injectable } from '@nestjs/common';

import { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import { CreatePayrollRunDto } from '../dto/create-payroll-run.dto';
import { PatchPayrollRunDto } from '../dto/patch-payroll-run.dto';
import { UpdatePayrollItemDto } from '../dto/update-payroll-item.dto';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollAccessGuard } from './payroll-access-guard';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayrollRunService } from './payroll-run.service';

@Injectable()
export class PayrollRunOps {
  constructor(
    private readonly payrollRunService: PayrollRunService,
    private readonly accessGuard: PayrollAccessGuard,
    private readonly payrollCalculationService: PayrollCalculationService,
    private readonly paymentMethodService: PaymentMethodService,
  ) {}

  private async assertEmployeesPaymentReady(
    tenantId: string,
    employeeIds: string[],
  ): Promise<void> {
    const results = await this.paymentMethodService.assessBulkPayrollReadiness(
      tenantId,
      employeeIds,
    );
    const notReady = results.filter((r) => !r.ready);
    if (notReady.length > 0) {
      throw new BadRequestException(
        `${notReady.length} employee(s) need a verified primary payout method and cannot be included.`,
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
    await this.assertEmployeesPaymentReady(tenantId, dto.employeeIds);
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
      await this.assertEmployeesPaymentReady(tenantId, dto.employeeIds);
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
}
