import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeatures } from 'src/common/decorators';
import { TenantMemberRole } from '../../../../common/enums';
import { FeatureAccess } from '../../../../common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from '../../../../common/guards/tenant-member-role.guard';
import type { IAuthenticatedMemberRequest } from '../../../../common/interfaces';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { PublishPayslipsDto } from '../dto/publish-payslips.dto';
import { PayrollService } from '../services/payroll.service';

@ApiTags('Payroll')
@Controller('tenants/:tenantId/payroll')
@UseGuards(TenantMemberGuard, TenantRoleGuard)
@RequireFeatures(FeatureAccess.PAYROLL)
export class PayrollExportController {
  constructor(private payrollService: PayrollService) {}

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
      tenantId,
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
      tenantId,
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
}
