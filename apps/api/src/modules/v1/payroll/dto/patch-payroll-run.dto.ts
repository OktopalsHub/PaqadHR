import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PayrollFrequency } from 'src/common/enums/payroll-frequency.enum';
import {
  IsAfterStartDate,
  IsNotFuture,
  IsValidPayrollPeriod,
} from 'src/common/validators/payroll-date.validator';

export class PatchPayrollRunDto {
  @ApiPropertyOptional({ description: 'Payroll run title', minLength: 3, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(100, { message: 'Title must not exceed 100 characters' })
  title?: string;

  @ApiPropertyOptional({ description: 'Payroll frequency', enum: PayrollFrequency })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(PayrollFrequency, {
    message: 'Frequency must be one of: weekly, biweekly, monthly, quarterly, annually',
  })
  frequency?: PayrollFrequency;

  @ApiPropertyOptional({ description: 'Pay period start date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @IsNotFuture({ message: 'Pay period start date cannot be in the future' })
  periodStart?: Date;

  @ApiPropertyOptional({ description: 'Pay period end date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @ValidateIf((o: PatchPayrollRunDto) => Boolean(o.periodStart) || Boolean(o.periodEnd))
  @IsAfterStartDate('periodStart', {
    message: 'Pay period end date must be after start date',
  })
  @IsValidPayrollPeriod({
    message: 'Pay period length is invalid for the selected frequency',
  })
  periodEnd?: Date;

  @ApiPropertyOptional({ description: 'Scheduled payment date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Expected pay date must be a valid date' })
  paymentDate?: Date;

  @ApiPropertyOptional({
    description: 'Employee IDs to include (replaces active roster)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one employee must be included in payroll' })
  @ArrayMaxSize(1000, {
    message: 'Cannot process more than 1000 employees in a single payroll run',
  })
  @ArrayUnique({ message: 'Employee IDs must be unique' })
  @IsUUID('4', { each: true, message: 'Each employee ID must be a valid UUID' })
  employeeIds?: string[];
}
