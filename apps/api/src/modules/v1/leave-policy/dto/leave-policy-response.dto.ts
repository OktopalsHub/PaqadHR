import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsUUID } from 'class-validator';
export class TenantLeavePolicyResponseDto {
  @ApiProperty({ description: 'Leave policy ID' })
  @IsUUID()
  id: string;
  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId: string;
  @ApiProperty({ description: 'Allow carryover of unused leave days' })
  @IsBoolean()
  allowCarryover: boolean;
  @ApiProperty({ description: 'Maximum days that can be carried over' })
  @IsNumber()
  maxCarryoverDays: number;
  @ApiProperty({
    description: 'Months after which carryover expires',
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  carryoverExpiryMonths?: number | null;
  @ApiProperty({ description: 'Automatically create annual leave balances' })
  @IsBoolean()
  autoCreateAnnualBalances: boolean;
  @ApiProperty({ description: 'Prorate leave for new joiners' })
  @IsBoolean()
  prorateForNewJoiners: boolean;
  @ApiProperty({ description: 'Creation date' })
  @IsDateString()
  createdAt: Date;
  @ApiProperty({ description: 'Last update date' })
  @IsDateString()
  updatedAt: Date;
}
