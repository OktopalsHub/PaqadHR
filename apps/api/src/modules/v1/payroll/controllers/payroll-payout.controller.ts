import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RateLimit, RateLimitPresets, RequireFeatures } from 'src/common/decorators';
import { TenantMemberRole } from '../../../../common/enums';
import { FeatureAccess } from '../../../../common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from '../../../../common/guards/tenant-member-role.guard';
import type { IAuthenticatedMemberRequest } from '../../../../common/interfaces';
import type { ProcessPayrollWithAudit } from '../../../../common/interfaces/process-payroll-dto.interface';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { DisbursePayrollDto } from '../dto/disburse-payroll.dto';
import { RetryFailedPaymentsDto } from '../dto/retry-failed-payments.dto';
import { SchedulePayrollPayoutDto } from '../dto/schedule-payroll-payout.dto';
import { MultiPaymentService } from '../services/multi-payment.service';
import { PayrollService } from '../services/payroll.service';
import { PayrollRunFundingLedgerService } from '../services/payroll-run-funding-ledger.service';

@ApiTags('Payroll')
@Controller('tenants/:tenantId/payroll')
@UseGuards(TenantMemberGuard, TenantRoleGuard)
@RequireFeatures(FeatureAccess.PAYROLL)
export class PayrollPayoutController {
  private readonly logger = new Logger(PayrollPayoutController.name);
  constructor(
    private payrollService: PayrollService,
    private multiPaymentService: MultiPaymentService,
    private payrollRunFundingLedger: PayrollRunFundingLedgerService,
  ) {}

  @Post('runs/:id/disburse')
  @RateLimit(RateLimitPresets.SENSITIVE)
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

  @Get('runs/:id/fund-and-pay/preflight')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async fundAndPayPreflight(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.payrollService.preflightPayrollFund(id, tenantId);
  }

  @Post('runs/:id/fund-and-pay')
  @RateLimit(RateLimitPresets.SENSITIVE)
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async fundAndPay(
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
    const outcome = await this.payrollService.fundAndPayPayroll(id, tenantId, auditContext);
    if (outcome.action === 'checkout') {
      return {
        message: 'Fund provider float to continue payroll',
        ...outcome,
      };
    }
    return {
      message: 'Payroll payout started',
      ...outcome,
      processedAt: new Date().toISOString(),
    };
  }

  @Post('runs/:id/pay-now')
  @RateLimit(RateLimitPresets.SENSITIVE)
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
    await this.payrollService.assertPayrollFunded(id, tenantId);
    const result = await this.payrollService.payNowPayroll(id, tenantId, auditContext);
    return {
      message: 'Payroll payout started',
      result,
      processedAt: new Date().toISOString(),
    };
  }

  @Post('runs/:id/schedule')
  @RateLimit(RateLimitPresets.SENSITIVE)
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async schedulePayout(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: SchedulePayrollPayoutDto,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const auditContext = {
      tenantId,
      payrollRunId: id,
      performedById: req.member.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    };
    await this.payrollService.schedulePayrollPayout(id, tenantId, dto.paymentDate, auditContext);
    try {
      const outcome = await this.payrollService.fundScheduledPayroll(id, tenantId, auditContext);
      if (outcome.action === 'checkout') {
        return {
          message: 'Complete checkout to fund this scheduled payroll',
          ...outcome,
        };
      }
      return {
        message: 'Payroll funded and scheduled',
        ...outcome,
      };
    } catch (error) {
      await this.payrollService.rollbackScheduledPayroll(id, tenantId);
      throw error;
    }
  }

  @Post('runs/:id/process-multi-payment')
  @RateLimit(RateLimitPresets.SENSITIVE)
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

  @Post('runs/:id/retry-funding/approve')
  @RateLimit(RateLimitPresets.SENSITIVE)
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async approveRetryFunding(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() retryDto: RetryFailedPaymentsDto,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    if (!retryDto.itemIds?.length) {
      throw new BadRequestException('Select failed payout items before approving retry funding');
    }
    return this.payrollService.approveRetryShortfall(id, tenantId, req.member.id, retryDto.itemIds);
  }

  @Post('runs/:id/retry-funding/checkout')
  @RateLimit(RateLimitPresets.SENSITIVE)
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async createRetryFundingCheckout(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    return this.payrollService.createRetryShortfallCheckout(id, tenantId, req.member.id);
  }

  @Post('runs/:id/retry-failed-payments')
  @RateLimit(RateLimitPresets.SENSITIVE)
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async retryFailedPayments(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() retryDto: RetryFailedPaymentsDto,
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
      await this.payrollService.assertRetryPayrollFunded(id, tenantId, retryDto.itemIds);
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

  @Get('runs/:id/funding-ledger')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async getFundingLedger(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.payrollRunFundingLedger.getRunLedger(tenantId, id);
  }

  @Get('runs/:id/payment-status')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async getPaymentStatus(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.multiPaymentService.getPaymentStatusSummary(id, tenantId);
  }
}
