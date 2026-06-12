import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';
export class UpdateLeavePolicyDto {
  @IsOptional()
  @IsBoolean()
  allowCarryover?: boolean;
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  maxCarryoverDays?: number;
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  carryoverExpiryMonths?: number | null;
  @IsOptional()
  @IsBoolean()
  autoCreateAnnualBalances?: boolean;
  @IsOptional()
  @IsBoolean()
  prorateForNewJoiners?: boolean;
}
