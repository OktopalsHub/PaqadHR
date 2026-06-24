import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { PayrollAdjustmentDto } from './payroll-adjustment.dto';

export class UpdatePayrollItemDto {
  @ApiPropertyOptional({ type: [PayrollAdjustmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollAdjustmentDto)
  adjustmentLines?: PayrollAdjustmentDto[];
}
