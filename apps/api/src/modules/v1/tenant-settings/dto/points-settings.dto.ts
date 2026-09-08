import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class PointsSettingsDto {
  @ApiProperty({
    description: 'Monthly points allowance for each member',
    example: 100,
    minimum: 0,
    maximum: 10000,
  })
  @IsNumber()
  @Min(0)
  @Max(10000)
  monthlyAllowance: number;
  @ApiProperty({
    description: 'How often shoutout points allowance resets',
    example: 'monthly',
    enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'],
    required: false,
  })
  @IsOptional()
  allowancePeriod?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  @ApiProperty({
    description: 'Maximum points per shoutout',
    example: 50,
    minimum: 1,
    maximum: 1000,
  })
  @IsNumber()
  @Min(1)
  @Max(1000)
  maxPointsPerShoutout: number;
  @ApiProperty({
    description: 'Minimum points per shoutout',
    example: 1,
    minimum: 1,
    maximum: 100,
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  minPointsPerShoutout: number;
  @ApiProperty({
    description: 'Whether to automatically assign points to all members',
    example: false,
  })
  @IsBoolean()
  autoAssignPoints: boolean;
  @ApiProperty({
    description: 'Amount of points to auto-assign when enabled',
    example: 0,
    minimum: 0,
    maximum: 1000,
  })
  @IsNumber()
  @Min(0)
  @Max(1000)
  autoAssignAmount: number;
  @ApiProperty({
    description: 'Starting balance for new members',
    example: 100,
    minimum: 0,
    maximum: 10000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  startingBalance?: number;
  @ApiProperty({
    description: 'Daily points limit per member',
    example: 50,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  dailyLimit?: number;
  @ApiProperty({
    description: 'Monthly points limit per member',
    example: 1000,
    minimum: 1,
    maximum: 50000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50000)
  monthlyLimit?: number;
}
