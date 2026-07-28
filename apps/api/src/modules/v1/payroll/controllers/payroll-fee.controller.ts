import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { RequireFeatures } from 'src/common/decorators';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { PayrollFeeService } from '../services/payroll-fee.service';

class PayrollFeeItemDto {
  @IsNumber()
  @Min(0.01)
  @Max(10_000_000)
  amount: number;

  @IsIn(['NGN', 'USD', 'GBP', 'EUR'])
  currency: string;
}

export class PayrollFeePreviewDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PayrollFeeItemDto)
  payrollItems: PayrollFeeItemDto[];
}

class SingleFeeCalculationDto {
  @IsNumber()
  @Min(0.01)
  @Max(10_000_000)
  amount: number;

  @IsIn(['NGN', 'USD', 'GBP', 'EUR'])
  currency: string;
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
  calculateSingleFee(@Body() body: SingleFeeCalculationDto, @Param('tenantId') tenantId: string) {
    return this.payrollFeeService.calculatePayrollFee({
      totalPayrollAmount: body.amount,
      currency: body.currency,
      tenantId,
    });
  }
}
