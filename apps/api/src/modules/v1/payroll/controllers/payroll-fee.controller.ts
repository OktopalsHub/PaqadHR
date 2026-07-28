import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireFeatures } from 'src/common/decorators';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { PayrollFeeService } from '../services/payroll-fee.service';
export class PayrollFeePreviewDto {
  payrollItems: Array<{ amount: number; currency: string }>;
}
@ApiTags('Payroll Fees')
@Controller('tenants/:tenantId/payroll/fees')
@UseGuards(TenantMemberGuard)
@RequireFeatures(FeatureAccess.PAYROLL)
export class PayrollFeeController {
  constructor(private readonly payrollFeeService: PayrollFeeService) {}
  @Post('preview')
  @ApiOperation({ summary: 'Preview payroll fees before processing' })
  previewPayrollFees(@Body() dto: PayrollFeePreviewDto, @Param('tenantId') tenantId: string) {
    return this.payrollFeeService.previewPayrollFees(dto.payrollItems, tenantId);
  }
  @Post('calculate')
  @ApiOperation({ summary: 'Calculate fee for a single currency payroll' })
  calculateSingleFee(
    @Body() body: { amount: number; currency: string },
    @Param('tenantId') tenantId: string,
  ) {
    return this.payrollFeeService.calculatePayrollFee({
      totalPayrollAmount: body.amount,
      currency: body.currency,
      tenantId,
    });
  }
}
