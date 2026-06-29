import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CurrentTenantMember, RequireFeatures } from 'src/common/decorators';
import { TenantMemberRole } from '../../../../common/enums';
import { FeatureAccess } from '../../../../common/enums/subscription.enum';
import { FeatureAccessGuard } from '../../../../common/guards/feature-access.guard';
import { Roles, TenantRoleGuard } from '../../../../common/guards/tenant-member-role.guard';
import type { IAuthenticatedMemberRequest, MemberContext } from '../../../../common/interfaces';
import type { ProcessPayrollWithAudit } from '../../../../common/interfaces/process-payroll-dto.interface';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import type { CreatePayrollRunDto } from '../dto/create-payroll-run.dto';
import type { DisbursePayrollDto } from '../dto/disburse-payroll.dto';
import type {
  PayrollCalculationPreviewDto,
  UpdatePayrollRunDto,
} from '../dto/payroll-adjustment.dto';
import type { PublishPayslipsDto } from '../dto/publish-payslips.dto';
import type { UpdatePayrollItemDto } from '../dto/update-payroll-item.dto';
import { AuditService } from '../services/audit.service';
import { MultiPaymentService } from '../services/multi-payment.service';
import { PayrollService } from '../services/payroll.service';

@Controller('tenants/:tenantId/payroll')
@UseGuards(TenantMemberGuard, TenantRoleGuard, FeatureAccessGuard)
@RequireFeatures(FeatureAccess.PAYROLL)
export class PayrollController {
  private readonly logger = new Logger(PayrollController.name);
  constructor(
    private payrollService: PayrollService,
    private multiPaymentService: MultiPaymentService,
    private auditService: AuditService,
  ) {}

  @Post('runs')
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async createPayrollRun(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CreatePayrollRunDto,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    this.logger.log(`Creating payroll run for tenant: ${tenantId}, member: ${member.id}`);
    try {
      const idempotencyKey = req.headers['idempotency-key'] as string;
      const result = await this.payrollService.createPayrollRun(
        dto,
        tenantId,
        member.id,
        idempotencyKey,
      );
      this.logger.log(`Successfully created payroll run: ${result.id} for tenant: ${tenantId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create payroll run for tenant: ${tenantId}`, error);
      throw error;
    }
  }

  @Get('runs')
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN, TenantMemberRole.MEMBER)
  async getPayrollRuns(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    this.logger.log(
      `Getting payroll runs for tenant: ${tenantId}, limit: ${limit}, offset: ${offset}`,
    );
    try {
      const result = await this.payrollService.getPayrollRunsForRequester(
        tenantId,
        Number(limit),
        Number(offset),
        member.id,
        member.role,
      );
      this.logger.log(
        `Successfully retrieved ${result.runs.length} payroll runs for tenant: ${tenantId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to get payroll runs for tenant: ${tenantId}`, error);
      throw error;
    }
  }

  @Get('runs/:id')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN, TenantMemberRole.MEMBER)
  async getPayrollRun(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    return this.payrollService.getPayrollRunForRequester(id, tenantId, member.id, member.role);
  }

  @Post('runs/:id/calculate')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async calculatePayroll(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    const auditContext = {
      payrollRunId: id,
      performedById: member.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    };
    const result = await this.payrollService.calculatePayroll(id, tenantId, auditContext);
    return {
      message: 'Payroll calculation completed',
      warnings: result.warnings,
      readiness: result.readiness,
    };
  }

  @Post('runs/:id/calculate-with-adjustments')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async calculatePayrollWithAdjustments(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdatePayrollRunDto,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    const auditContext = {
      payrollRunId: id,
      performedById: member.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    };
    const result = await this.payrollService.calculatePayroll(
      id,
      tenantId,
      auditContext,
      updateDto.adjustments,
    );
    return {
      message: 'Payroll calculation completed',
      warnings: result.warnings,
      readiness: result.readiness,
    };
  }

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
      payrollRunId: id,
      performedById: member.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    };
    const run = await this.payrollService.updatePayrollItem(
      id,
      itemId,
      tenantId,
      dto,
      auditContext,
    );
    return {
      message: 'Payroll item updated',
      payrollRun: run,
    };
  }

  @Post('preview-calculation')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async previewPayrollCalculation(
    @Param('tenantId') tenantId: string,
    @Body() previewDto: PayrollCalculationPreviewDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.payrollService.previewPayrollCalculation(tenantId, previewDto, member.id);
  }

  @Get('runs/:id/readiness')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async getPayrollReadiness(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.payrollService.getPayrollReadiness(id, tenantId);
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
      payrollRunId: id,
      performedById: member.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    };
    const run = await this.payrollService.removePayrollItem(id, itemId, tenantId, auditContext);
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
    const result = await this.payrollService.notifyEmployeePaymentSetup(
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

  @Post('runs/:id/approve')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async approvePayrollRun(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    const auditContext = {
      payrollRunId: id,
      performedById: member.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    };
    const run = await this.payrollService.approvePayrollRun(id, tenantId, auditContext);
    return {
      message: 'Payroll run approved',
      payrollRunId: id,
      status: run.status,
      approvedAt: run.metadata?.approvedAt,
    };
  }

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

  @Get('runs/:id/export/bank-file')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @Header('Content-Type', 'text/csv')
  async exportBankFile(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    const auditContext = {
      payrollRunId: id,
      performedById: member.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    };
    const csv = await this.payrollService.exportBankFile(id, tenantId, auditContext);
    return csv;
  }

  @Get('runs/:id/items/:itemId/payslip')
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN, TenantMemberRole.MEMBER)
  @Header('Content-Type', 'text/html')
  async getPayslip(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    return this.payrollService.getPayslipHtml(id, itemId, tenantId, member.id, member.role);
  }

  @Get('runs/:id/items/:itemId/payslip/download')
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN, TenantMemberRole.MEMBER)
  async downloadPayslip(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Req() req: IAuthenticatedMemberRequest,
  ): Promise<StreamableFile> {
    const member = req.member;
    const buffer = await this.payrollService.getPayslipPdf(
      id,
      itemId,
      tenantId,
      member.id,
      member.role,
    );
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="payslip-${itemId.slice(0, 8)}.pdf"`,
    });
  }

  @Get('members/:memberId/published-payslips')
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN, TenantMemberRole.MEMBER)
  async getMemberPublishedPayslips(
    @Param('tenantId') tenantId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    return this.payrollService.getMemberPublishedPayslips(
      memberId,
      tenantId,
      member.id,
      member.role,
    );
  }

  @Get('runs/:id/payslips')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async getRunPayslips(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.payrollService.getRunPayslips(id, tenantId);
  }

  @Post('runs/:id/payslips/publish')
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN, TenantMemberRole.MEMBER)
  async publishPayslips(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() body: PublishPayslipsDto,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    const auditContext = {
      payrollRunId: id,
      performedById: member.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    };
    const result = await this.payrollService.publishPayslips(
      id,
      tenantId,
      auditContext,
      body.itemIds,
      body.sendEmail,
      member.id,
      member.role,
    );
    return {
      message: 'Payslips published',
      ...result,
    };
  }

  @Post('runs/:id/process')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async processPayroll(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    this.logger.log(`Processing payroll run: ${id} for tenant: ${tenantId}, member: ${member.id}`);
    try {
      const dto: ProcessPayrollWithAudit = {
        payrollRunId: id,
        tenantId,
        auditContext: {
          payrollRunId: id,
          performedById: member.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      };
      await this.payrollService.processPayroll(dto);
      this.logger.log(`Successfully processed payroll run: ${id} for tenant: ${tenantId}`);
      return {
        message: 'Payroll processing completed',
        payrollRunId: id,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to process payroll run: ${id} for tenant: ${tenantId}`, error);
      throw error;
    }
  }

  @Get('runs/:id/audit')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async getAuditTrail(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.auditService.getAuditTrail(id, tenantId);
  }

  @Get('runs/:id/audit/report')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async getAuditReport(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.auditService.generateAuditReport(id);
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
    this.logger.log(`Processing multi-payment payroll run: ${id} for tenant: ${tenantId}`);
    try {
      const auditContext = {
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
      this.logger.log(`Multi-payment processing completed for payroll run: ${id}`);
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
    this.logger.log(`Retrying failed payments for payroll run: ${id}`);
    try {
      const auditContext = {
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
      this.logger.log(`Payment retry completed for payroll run: ${id}`);
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
