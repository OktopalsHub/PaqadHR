import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RequireFeatures } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { PayrollFeeService } from '../services/payroll-fee.service';

class PayrollFeeItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  provider?: string;

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
  @IsOptional()
  @IsString()
  @MaxLength(32)
  provider?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  transferCount?: number;

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
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @ApiOperation({ summary: 'Preview payroll fees before processing' })
  previewPayrollFees(@Body() dto: PayrollFeePreviewDto, @Param('tenantId') tenantId: string) {
    return this.payrollFeeService.previewPayrollFees(dto.payrollItems, tenantId);
  }

  @Post('calculate')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @ApiOperation({ summary: 'Calculate fee for a single currency payroll' })
  calculateSingleFee(@Body() body: SingleFeeCalculationDto, @Param('tenantId') tenantId: string) {
    return this.payrollFeeService.calculatePayrollFee({
      totalPayrollAmount: body.amount,
      currency: body.currency,
      tenantId,
      provider: body.provider,
      transferCount: body.transferCount,
    });
  }
}
