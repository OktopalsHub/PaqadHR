import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';

const PLAN_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateSubscriptionCheckoutDto {
  @ApiProperty({ example: 'starter', description: 'Plan slug from the billing overview' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(PLAN_SLUG_PATTERN, { message: 'planSlug must be a valid plan identifier' })
  planSlug: string;

  @ApiProperty({
    required: false,
    description: 'Optional return URL on your workspace (same origin as FRONTEND_URL)',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  successUrl?: string;
}
