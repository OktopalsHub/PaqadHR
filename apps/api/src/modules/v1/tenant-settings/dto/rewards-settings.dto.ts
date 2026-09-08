import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SUPPORTED_FIAT_CURRENCIES } from 'src/common/constants/supported-fiat-currencies.constant';

export class ShoutoutCelebrationTemplateDto {
  @ApiProperty({ description: 'Whether this celebration shoutout is enabled', required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
  @ApiProperty({ description: 'Points to award the celebrant', required: false, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  points?: number;
  @ApiProperty({
    description: 'Message template. Placeholders: {name}, {years}, {company}',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  messageTemplate?: string;
}
export class ShoutoutSettingsDto {
  @ApiProperty({
    description: 'Maximum recipients per shoutout',
    example: 10,
    minimum: 1,
    maximum: 50,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  maxRecipientsPerShoutout?: number;
  @ApiProperty({
    description: 'Enable shoutout categories (core values)',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  enableCategories?: boolean;
  @ApiProperty({
    description: 'Automated birthday shoutout settings',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShoutoutCelebrationTemplateDto)
  birthday?: ShoutoutCelebrationTemplateDto;
  @ApiProperty({
    description: 'Automated work anniversary shoutout settings',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShoutoutCelebrationTemplateDto)
  workAnniversary?: ShoutoutCelebrationTemplateDto;
}

export class TremendousProductDto {
  @ApiProperty({ example: 'XVBOXHD007XB' })
  @IsString()
  productId: string;

  @ApiProperty({ example: 'Amazon Gift Card' })
  @IsString()
  name: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0)
  pointsCost: number;

  @ApiProperty({ example: 'https://cdn.example.com/card.png', nullable: true })
  @IsString()
  imageUrl: string | null;

  @ApiProperty({ example: 'US' })
  @IsString()
  countryCode: string;

  @ApiProperty({ example: 'USD' })
  @IsString()
  currencyCode: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  minDenomination?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  maxDenomination?: number | null;

  @ApiProperty({ required: false, type: [Number] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  fixedDenominations?: number[];

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  listTremendousCost?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  listTremendousCostCurrency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  wholesaleInRewardsCurrency?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  subcategory?: string;
}

export class RewardsSettingsDto {
  @ApiProperty({
    description: 'Whether the rewards redemption system is enabled',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({
    description: 'Points-to-currency exchange rate',
    example: 0.75,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  pointsExchangeRate?: number;

  @ApiProperty({
    description: 'Workspace currency used for rewards pricing',
    example: 'USD',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_FIAT_CURRENCIES])
  rewardsCurrency?: string;

  @ApiProperty({
    description: 'Allowed ISO country codes for gift card catalog (tenant country always included)',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  catalogCountries?: string[];

  @ApiProperty({
    description: 'Whether NG airtime/data vending is enabled',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  airtimeEnabled?: boolean;

  @ApiProperty({
    description: 'Whether custom rewards are enabled',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  customRewardsEnabled?: boolean;

  @ApiProperty({
    description: 'Whether gift cards rewards are enabled',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  giftCardsEnabled?: boolean;

  @ApiProperty({
    description: 'Allowed gift card categories to show',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  giftCardCategories?: string[];

  @ApiProperty({
    description: 'Whether utility payments are enabled',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  utilityPaymentsEnabled?: boolean;

  @ApiProperty({
    description: 'Cached Tremendous gift card products',
    type: [TremendousProductDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TremendousProductDto)
  tremendousProducts?: TremendousProductDto[];
}
