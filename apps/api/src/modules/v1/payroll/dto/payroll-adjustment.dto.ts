import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AdjustmentMethod } from '../../../../common/enums/adjustment-method.enum';
import { AdjustmentType } from '../../../../common/enums/adjustment-type.enum';

export class PayrollAdjustmentDto {
  @ApiProperty({ description: 'Employee ID' })
  @IsUUID('4', { message: 'Employee ID must be a valid UUID' })
  employeeId: string;
  @ApiProperty({
    description: 'Type of adjustment',
    enum: AdjustmentType,
    example: AdjustmentType.BONUS,
  })
  @IsEnum(AdjustmentType, { message: 'Invalid adjustment type' })
  type: AdjustmentType;
  @ApiProperty({
    description: 'Adjustment method',
    enum: AdjustmentMethod,
    example: AdjustmentMethod.FIXED_AMOUNT,
  })
  @IsEnum(AdjustmentMethod, { message: 'Invalid adjustment method' })
  method: AdjustmentMethod;
  @ApiProperty({
    description: 'Adjustment value (amount or percentage)',
    example: 1000,
  })
  @IsNumber({}, { message: 'Value must be a number' })
  @Min(0, { message: 'Value cannot be negative' })
  @Max(1000000, { message: 'Value cannot exceed 1,000,000' })
  value: number;
  @ApiProperty({ description: 'Reason for adjustment' })
  @IsString()
  @IsNotEmpty({ message: 'Reason is required' })
  @MaxLength(500, { message: 'Reason cannot exceed 500 characters' })
  reason: string;
  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Notes cannot exceed 1000 characters' })
  notes?: string;
  @ApiPropertyOptional({ description: 'Currency for fixed amounts' })
  @IsOptional()
  @IsString()
  currency?: string;
}
export class UpdatePayrollRunDto {
  @ApiPropertyOptional({
    description: 'Payroll adjustments for employees',
    type: [PayrollAdjustmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollAdjustmentDto)
  adjustments?: PayrollAdjustmentDto[];
  @ApiPropertyOptional({ description: 'Notes for this payroll run' })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Notes cannot exceed 1000 characters' })
  notes?: string;
}
export class PayrollPreviewDto {
  @ApiProperty({ description: 'Employee ID' })
  @IsUUID('4')
  employeeId: string;
  @ApiProperty({ description: 'Base salary from employment record' })
  @IsNumber()
  baseSalary: number;
  @ApiProperty({ description: 'Currency' })
  @IsString()
  currency: string;
  @ApiPropertyOptional({
    description: 'Adjustments to apply',
    type: [PayrollAdjustmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollAdjustmentDto)
  adjustments?: PayrollAdjustmentDto[];
}
export class PayrollCalculationPreviewDto {
  @ApiProperty({
    description: 'Employee previews with adjustments',
    type: [PayrollPreviewDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollPreviewDto)
  employees: PayrollPreviewDto[];
}
