import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class StartOrganizationBridgeOnboardingDto {
  @ApiProperty({ description: 'Organization legal name as registered with its authorities.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  legalBusinessName: string;
}
