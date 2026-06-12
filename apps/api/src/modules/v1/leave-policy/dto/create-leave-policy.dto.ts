import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, Min, Max } from 'class-validator';
export class CreateLeavePolicyDto {
  @IsOptional()
  @IsBoolean()
  allowCarryover?: boolean;
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  maxCarryoverDays?: number;
  @IsOptional()
  @Transform(({ value }) => (value === null ? undefined : value))
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
