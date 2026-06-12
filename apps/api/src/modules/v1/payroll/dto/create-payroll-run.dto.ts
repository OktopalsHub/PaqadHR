import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  IsDateString,
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsISO4217CurrencyCode,
  IsUUID,
  MaxLength,
  MinLength,
  IsNotEmpty,
} from 'class-validator';
import { TransactionType } from 'src/common/enums';
import {
  IsNotFuture,
  IsAfterStartDate,
  IsValidPayrollPeriod,
} from 'src/common/validators/payroll-date.validator';
export class PayrollItemDto {
  @ApiProperty({ description: 'Member ID' })
  @IsString()
  memberId: string;
  @ApiProperty({ description: 'Payment amount' })
  @IsNumber()
  amount: number;
  @ApiProperty({ description: 'Currency code' })
  @IsString()
  currency: string;
  @ApiProperty({ description: 'Crypto wallet address' })
  @IsString()
  cryptoAddress: string;
  @ApiProperty({ description: 'Cryptocurrency type' })
  @IsString()
  cryptoCurrency: string;
}
export class CreatePayrollItemDto {
  @ApiProperty({ description: 'Member ID' })
  @IsString()
  memberId: string;
  @ApiProperty({ description: 'Payment amount' })
  @IsNumber()
  amount: number;
  @ApiPropertyOptional({ description: 'Currency code' })
  @IsOptional()
  @IsString()
  currency?: string;
  @ApiPropertyOptional({ description: 'Crypto wallet address' })
  @IsOptional()
  @IsString()
  cryptoAddress?: string;
  @ApiPropertyOptional({ description: 'Cryptocurrency type' })
  @IsOptional()
  @IsString()
  cryptoCurrency?: string;
  @ApiPropertyOptional({ description: 'Bank account number' })
  @IsOptional()
  @IsString()
  bankAccount?: string;
  @ApiPropertyOptional({ description: 'Bank name' })
  @IsOptional()
  @IsString()
  bankName?: string;
  @ApiPropertyOptional({ description: 'Recipient name' })
  @IsOptional()
  @IsString()
  recipientName?: string;
  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsString()
  email?: string;
  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;
}
export class CreatePayrollRunDto {
  @ApiProperty({ description: 'Payroll run title/description' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(100, { message: 'Title must not exceed 100 characters' })
  title: string;
  @ApiProperty({
    description: 'Payroll frequency',
    enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'annually'],
    example: 'monthly',
  })
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsEnum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annually'], {
    message:
      'Frequency must be one of: weekly, biweekly, monthly, quarterly, annually',
  })
  frequency: string;
  @ApiProperty({ description: 'Pay period start date' })
  @Type(() => Date)
  @IsNotFuture({ message: 'Pay period start date cannot be in the future' })
  periodStart: Date;
  @ApiProperty({ description: 'Pay period end date' })
  @Type(() => Date)
  @IsAfterStartDate('periodStart', {
    message: 'Pay period end date must be after start date',
  })
  @IsValidPayrollPeriod({
    message: 'Pay period length is invalid for the selected frequency',
  })
  periodEnd: Date;
  @ApiProperty({ description: 'Scheduled payment date' })
  @Type(() => Date)
  @IsAfterStartDate('periodEnd', {
    message: 'Payment date must be after pay period end date',
  })
  paymentDate: Date;
  @ApiProperty({ description: 'Base currency for calculations' })
  @IsString()
  @IsNotEmpty()
  @IsISO4217CurrencyCode({
    message: 'Base currency must be a valid ISO 4217 currency code',
  })
  baseCurrency: string;
  @ApiProperty({
    description: 'Array of employee IDs to include in payroll',
    type: [String],
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'At least one employee must be included in payroll',
  })
  @ArrayMaxSize(1000, {
    message: 'Cannot process more than 1000 employees in a single payroll run',
  })
  @ArrayUnique({ message: 'Employee IDs must be unique' })
  @IsUUID('4', { each: true, message: 'Each employee ID must be a valid UUID' })
  employeeIds: string[];
}
export class FeePreviewDto {
  @ApiProperty({ description: 'Transaction amount' })
  @IsNumber()
  amount: number;
  @ApiPropertyOptional({ description: 'Currency code' })
  @IsOptional()
  @IsString()
  currency?: string;
  @ApiProperty({ description: 'Transaction type', enum: TransactionType })
  @IsEnum(TransactionType)
  transactionType: TransactionType;
}
export class ProcessPayrollRunDto {
  @ApiPropertyOptional({
    description: 'Processing mode',
    enum: ['bulk', 'individual'],
  })
  @IsOptional()
  @IsString()
  mode?: 'bulk' | 'individual';
}
