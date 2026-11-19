import { Body, Controller, Delete, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeatures } from 'src/common/decorators';

import { TenantMemberRole } from '../../../../common/enums';
import { FeatureAccess } from '../../../../common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from '../../../../common/guards/tenant-member-role.guard';
import type { IAuthenticatedMemberRequest } from '../../../../common/interfaces';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { UpdatePayrollItemDto } from '../dto/update-payroll-item.dto';
import { PayrollPayslipOps } from '../services/payroll-payslip.ops';
import { PayrollRunOps } from '../services/payroll-run.ops';

@ApiTags('Payroll')
@Controller('tenants/:tenantId/payroll')
@UseGuards(TenantMemberGuard, TenantRoleGuard)
@RequireFeatures(FeatureAccess.PAYROLL)
export class PayrollItemsController {
  constructor(
    private readonly payslips: PayrollPayslipOps,
    private readonly runs: PayrollRunOps,
  ) {}

  @Patch('runs/:id/items/:itemId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async updatePayrollItem(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePayrollItemDto,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    const auditContext = {
      tenantId,
      payrollRunId: id,
      performedById: member.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    };
    const run = await this.runs.updatePayrollItem(id, itemId, tenantId, dto, auditContext);
    return {
      message: 'Payroll item updated',
      payrollRun: run,
    };
  }

  @Delete('runs/:id/items/:itemId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async removePayrollItem(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    const auditContext = {
      tenantId,
      payrollRunId: id,
      performedById: member.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    };
    const run = await this.runs.removePayrollItem(id, itemId, tenantId, auditContext);
    return {
      message: 'Employee removed from payroll run',
      payrollRunId: id,
      employeeCount: run.employeeCount,
    };
  }

  @Post('runs/:id/items/:itemId/notify-payment-setup')
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN, TenantMemberRole.MEMBER)
  async notifyEmployeePaymentSetup(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    const result = await this.payslips.notifyEmployeePaymentSetup(
      id,
      itemId,
      tenantId,
      member.id,
      member.role,
    );
    return {
      message: 'Employee notified to complete payment settings',
      ...result,
    };
  }
}
