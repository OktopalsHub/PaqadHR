import { ForbiddenException, Injectable, Optional } from '@nestjs/common';
import type { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import { ManagerAccessService } from '../../../../common/services/manager-access.service';
import { TenantConfigService } from '../../tenant-settings/services/tenant-config.service';
import { TenantsService } from '../../tenants/tenants.service';
import type { CreatePayrollRunDto } from '../dto/create-payroll-run.dto';
import type { PatchPayrollRunDto } from '../dto/patch-payroll-run.dto';
import type { UpdatePayrollItemDto } from '../dto/update-payroll-item.dto';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { AuditService } from './audit.service';
import { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';
import { RunLifecycle } from './run-lifecycle';
import { RunPayslips } from './run-payslips';

@Injectable()
export class PayrollRunService {
  private readonly lifecycle: RunLifecycle;
  private readonly payslips: RunPayslips;

  constructor(
    readonly payrollRunRepository: PayrollRunRepository,
    readonly payrollItemRepository: PayrollItemRepository,
    readonly auditService: AuditService,
    readonly managerAccessService: ManagerAccessService,
    @Optional() tenantConfigService?: TenantConfigService,
    @Optional() tenantsService?: TenantsService,
    @Optional() lifecycleNotify?: PayrollLifecycleNotifyService,
  ) {
    this.lifecycle = new RunLifecycle(
      payrollRunRepository,
      payrollItemRepository,
      auditService,
      managerAccessService,
    );
    this.payslips = new RunPayslips(
      payrollRunRepository,
      payrollItemRepository,
      auditService,
      managerAccessService,
      tenantConfigService,
      tenantsService,
      lifecycleNotify,
    );
  }

  isPayrollAdmin(role: string): boolean {
    return this.lifecycle.isPayrollAdmin(role);
  }

  async assertPayrollMemberAccess(
    tenantId: string,
    targetMemberId: string,
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<void> {
    if (this.isPayrollAdmin(requesterRole) || targetMemberId === requesterMemberId) return;
    const isManager = await this.managerAccessService.isManagerOf(
      tenantId,
      requesterMemberId,
      targetMemberId,
    );
    if (!isManager)
      throw new ForbiddenException(
        'You can only access payroll for yourself or your direct reports',
      );
  }

  async createPayrollRun(
    dto: CreatePayrollRunDto,
    tenantId: string,
    createdById: string,
    idempotencyKey?: string,
  ): Promise<PayrollRun & { alreadyExists?: boolean }> {
    return this.lifecycle.createPayrollRun(dto, tenantId, createdById, idempotencyKey);
  }

  async getPayrollRun(id: string, tenantId: string): Promise<PayrollRun | null> {
    return this.lifecycle.getPayrollRun(id, tenantId);
  }

  async getPayrollRuns(tenantId: string, limit = 20, offset = 0) {
    return this.lifecycle.getPayrollRuns(tenantId, limit, offset);
  }

  async getPayrollRunsForRequester(
    tenantId: string,
    limit: number,
    offset: number,
    requesterMemberId: string,
    requesterRole: string,
  ) {
    return this.lifecycle.getPayrollRunsForRequester(
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
  ): Promise<PayrollRun | null> {
    return this.lifecycle.getPayrollRunForRequester(id, tenantId, requesterMemberId, requesterRole);
  }

  async updatePayrollRun(
    payrollRunId: string,
    tenantId: string,
    dto: PatchPayrollRunDto,
    auditContext: AuditContext,
  ): Promise<PayrollRun> {
    return this.lifecycle.updatePayrollRun(payrollRunId, tenantId, dto, auditContext);
  }

  async deletePayrollRun(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<void> {
    return this.lifecycle.deletePayrollRun(payrollRunId, tenantId, auditContext);
  }

  async reopenPayrollRun(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<PayrollRun> {
    return this.lifecycle.reopenPayrollRun(payrollRunId, tenantId, auditContext);
  }

  async removePayrollItem(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<PayrollRun> {
    return this.lifecycle.removePayrollItem(payrollRunId, itemId, tenantId, auditContext);
  }

  async updatePayrollItem(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
    dto: UpdatePayrollItemDto,
    auditContext: AuditContext,
  ): Promise<PayrollRun> {
    return this.lifecycle.updatePayrollItem(payrollRunId, itemId, tenantId, dto, auditContext);
  }

  async getRunPayslips(payrollRunId: string, tenantId: string) {
    return this.payslips.getRunPayslips(payrollRunId, tenantId);
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
    return this.payslips.publishPayslips(
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
  ): Promise<{ notified: boolean }> {
    return this.payslips.notifyEmployeePaymentSetup(
      payrollRunId,
      itemId,
      tenantId,
      requesterMemberId,
      requesterRole,
    );
  }
}
