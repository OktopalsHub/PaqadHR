import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeatures } from 'src/common/decorators';
import { TenantMemberRole } from '../../../../common/enums';
import { FeatureAccess } from '../../../../common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from '../../../../common/guards/tenant-member-role.guard';
import type { IAuthenticatedMemberRequest } from '../../../../common/interfaces';
import type { ProcessPayrollWithAudit } from '../../../../common/interfaces/process-payroll-dto.interface';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { CreatePayrollRunDto } from '../dto/create-payroll-run.dto';
import { PatchPayrollRunDto } from '../dto/patch-payroll-run.dto';
import { UpdatePayrollRunDto } from '../dto/payroll-adjustment.dto';
import { AuditService } from '../services/audit.service';
import { PayrollService } from '../services/payroll.service';

@ApiTags('Payroll')
@Controller('tenants/:tenantId/payroll')
@UseGuards(TenantMemberGuard, TenantRoleGuard)
@RequireFeatures(FeatureAccess.PAYROLL)
export class PayrollRunsController {
  private readonly logger = new Logger(PayrollRunsController.name);
  constructor(
    private payrollService: PayrollService,
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
    try {
      const idempotencyKey = req.headers['idempotency-key'] as string;
      const result = await this.payrollService.createPayrollRun(
        dto,
        tenantId,
        member.id,
        idempotencyKey,
      );
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
    @Query('limit') limit = 100,
    @Query('offset') offset = 0,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const member = req.member;
    try {
      const result = await this.payrollService.getPayrollRunsForRequester(
        tenantId,
        Number(limit),
        Number(offset),
        member.id,
        member.role,
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
      tenantId,
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
      tenantId,
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

  @Get('setup-summary')
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async getSetupSummary(@Param('tenantId') tenantId: string) {
    return this.payrollService.getWorkspaceSetupSummary(tenantId);
  }

  @Post('notify-payment-setup')
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async notifyMemberPaymentSetup(
    @Param('tenantId') tenantId: string,
    @Body('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const result = await this.payrollService.notifyMemberPaymentSetup(
      tenantId,
      memberId,
      req.member.role,
      req.member.id,
    );
    return {
      message: 'Employee notified to complete payment settings',
      ...result,
    };
  }

  @Get('runs/:id/readiness')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async getPayrollReadiness(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.payrollService.getPayrollReadiness(id, tenantId);
  }

  @Delete('runs/:id')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async deletePayrollRun(
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
    await this.payrollService.deletePayrollRun(id, tenantId, auditContext);
    return {
      message: 'Payroll run deleted',
      payrollRunId: id,
    };
  }

  @Patch('runs/:id')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async patchPayrollRun(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: PatchPayrollRunDto,
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
    const run = await this.payrollService.updatePayrollRun(id, tenantId, dto, auditContext);
    return {
      message: 'Payroll run updated',
      payrollRun: run,
    };
  }

  @Post('runs/:id/reopen')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async reopenPayrollRun(
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
    const run = await this.payrollService.reopenPayrollRun(id, tenantId, auditContext);
    return {
      message: 'Payroll run reopened to draft',
      payrollRun: run,
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
      tenantId,
      payrollRunId: id,
      performedById: member.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    };
    const run = await this.payrollService.approvePayroll(id, tenantId, auditContext);
    return {
      message: 'Payroll run approved',
      payrollRunId: id,
      status: run.status,
      approvedAt: run.metadata?.approvedAt,
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
    try {
      const dto: ProcessPayrollWithAudit = {
        payrollRunId: id,
        tenantId,
        auditContext: {
          tenantId,
          payrollRunId: id,
          performedById: member.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      };
      await this.payrollService.processPayroll(dto);
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
    return this.auditService.generateAuditReport(id, tenantId);
  }
}
