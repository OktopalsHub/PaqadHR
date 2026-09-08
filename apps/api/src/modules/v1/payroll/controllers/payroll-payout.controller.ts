import { Body, Controller, Get, Logger, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeatures } from 'src/common/decorators';
import { TenantMemberRole } from '../../../../common/enums';
import { FeatureAccess } from '../../../../common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from '../../../../common/guards/tenant-member-role.guard';
import type { IAuthenticatedMemberRequest } from '../../../../common/interfaces';
import type { ProcessPayrollWithAudit } from '../../../../common/interfaces/process-payroll-dto.interface';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { DisbursePayrollDto } from '../dto/disburse-payroll.dto';
import { SchedulePayrollPayoutDto } from '../dto/schedule-payroll-payout.dto';
import { MultiPaymentService } from '../services/multi-payment.service';
import { PayrollService } from '../services/payroll.service';

@ApiTags('Payroll')
@Controller('tenants/:tenantId/payroll')
@UseGuards(TenantMemberGuard, TenantRoleGuard)
@RequireFeatures(FeatureAccess.PAYROLL)
export class PayrollPayoutController {
  private readonly logger = new Logger(PayrollPayoutController.name);
  constructor(
    private payrollService: PayrollService,
    private multiPaymentService: MultiPaymentService,
  ) {}

  @Post('runs/:id/disburse')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async disbursePayroll(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() body: DisbursePayrollDto,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    const dto: ProcessPayrollWithAudit & { confirmed: boolean } = {
      payrollRunId: id,
      tenantId,
      confirmed: body.confirmed,
      auditContext: {
        tenantId,
        payrollRunId: id,
        performedById: member.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    };
    const result = await this.payrollService.disburseManualPayroll(dto);
    return {
      message: 'Manual disbursement completed',
      payrollRunId: id,
      ...result,
      disbursedAt: new Date().toISOString(),
    };
  }

  @Post('runs/:id/pay-now')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async payNow(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
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
    const result = await this.payrollService.payNowPayroll(id, tenantId, auditContext);
    return {
      message: 'Payroll payout started',
      result,
      processedAt: new Date().toISOString(),
    };
  }

  @Post('runs/:id/schedule')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async schedulePayout(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: SchedulePayrollPayoutDto,
  ) {
    const run = await this.payrollService.schedulePayrollPayout(id, tenantId, dto.paymentDate);
    return {
      message: 'Payroll scheduled',
      run,
    };
  }

  @Post('runs/:id/process-multi-payment')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async processMultiPaymentPayroll(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    try {
      const auditContext = {
        tenantId,
        payrollRunId: id,
        performedById: member.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      };
      const result = await this.multiPaymentService.processMultiPaymentPayroll(
        id,
        tenantId,
        auditContext,
      );
      return {
        message: 'Multi-payment processing completed',
        result,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to process multi-payment payroll run: ${id}`, error);
      throw error;
    }
  }

  @Post('runs/:id/retry-failed-payments')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async retryFailedPayments(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() retryDto: { itemIds?: string[] },
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    try {
      const auditContext = {
        tenantId,
        payrollRunId: id,
        performedById: member.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      };
      const result = await this.multiPaymentService.retryFailedPayments(
        id,
        tenantId,
        auditContext,
        retryDto.itemIds,
      );
      return {
        message: 'Payment retry completed',
        result,
        retriedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to retry payments for payroll run: ${id}`, error);
      throw error;
    }
  }

  @Get('runs/:id/payment-status')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async getPaymentStatus(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.multiPaymentService.getPaymentStatusSummary(id, tenantId);
  }
}
