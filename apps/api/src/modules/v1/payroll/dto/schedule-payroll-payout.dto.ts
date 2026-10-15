import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';
import { IsNotPast } from 'src/common/validators/payroll-date.validator';

export class SchedulePayrollPayoutDto {
  @ApiPropertyOptional({
    description: 'Payment date for scheduled payout (defaults to run paymentDate)',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @IsNotPast({ message: 'Payment date cannot be in the past' })
  paymentDate?: Date;
}
