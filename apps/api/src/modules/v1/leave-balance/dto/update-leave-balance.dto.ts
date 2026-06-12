import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
export class UpdateLeaveBalanceDto {
  @ApiPropertyOptional({
    description: 'Total days allocated for this leave type',
    example: 20,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalDays?: number;
  @ApiPropertyOptional({
    description: 'Number of days already used',
    example: 5,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  usedDays?: number;
  @ApiPropertyOptional({
    description: 'Number of days remaining',
    example: 15,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  remainingDays?: number;
}
