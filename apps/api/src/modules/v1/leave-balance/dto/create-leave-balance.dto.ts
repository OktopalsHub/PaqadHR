import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
export class CreateLeaveBalanceDto {
  @ApiProperty({
    description: 'Total days allocated for this leave type',
    example: 20,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  totalDays: number;
  @ApiProperty({
    description: 'Number of days already used',
    example: 5,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  usedDays: number;
  @ApiProperty({
    description: 'Number of days remaining',
    example: 15,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  remainingDays: number;
  @ApiProperty({
    description: 'Year for this leave balance',
    example: 2024,
  })
  @IsInt()
  year: number;
}
