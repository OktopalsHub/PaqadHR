import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export class SchedulePayrollPayoutDto {
  @ApiPropertyOptional({
    description: 'Payment date for scheduled payout (defaults to run paymentDate)',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paymentDate?: Date;
}
