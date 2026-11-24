import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import type { RewardType } from '../entities/reward-redemption.entity';

export const CLAIM_REWARD_TYPES: RewardType[] = [
  'TREMENDOUS',
  'NOMBA_AIRTIME',
  'NOMBA_UTILITY',
  'CUSTOM',
];
export const CLAIM_MAX_POINTS = 100_000_000;
export const CLAIM_MAX_CURRENCY_VALUE = 10_000_000;

export class ClaimRewardDto {
  @ApiProperty({ enum: CLAIM_REWARD_TYPES })
  @IsIn(CLAIM_REWARD_TYPES)
  rewardType!: RewardType;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  rewardId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  rewardName?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(CLAIM_MAX_POINTS)
  pointsCost!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(CLAIM_MAX_CURRENCY_VALUE)
  currencyValue!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  recipientEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  recipientPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  providerProductId?: number;

  @ApiPropertyOptional({ enum: ['MTN', 'AIRTEL', 'GLO', '9MOBILE'] })
  @IsOptional()
  @IsIn(['MTN', 'AIRTEL', 'GLO', '9MOBILE'])
  airtimeNetwork?: 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';

  @ApiPropertyOptional({ enum: ['airtime', 'data'] })
  @IsOptional()
  @IsIn(['airtime', 'data'])
  topupKind?: 'airtime' | 'data';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dataPlanCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'number' ? String(value) : value))
  @IsString()
  @MaxLength(100)
  billerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountNumber?: string;

  @ApiPropertyOptional({ enum: ['PREPAID', 'POSTPAID'] })
  @IsOptional()
  @IsIn(['PREPAID', 'POSTPAID'])
  serviceType?: string;
}
