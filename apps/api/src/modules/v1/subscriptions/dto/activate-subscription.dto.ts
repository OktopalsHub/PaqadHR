import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ActivateSubscriptionDto {
  @IsOptional()
  @IsString()
  planSlug?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  periodMonths?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
