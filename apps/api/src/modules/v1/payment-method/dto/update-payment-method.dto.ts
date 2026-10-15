import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaymentMethodMetadataDto } from './shared-types';

export class UpdatePaymentMethodDto {
  @ApiProperty({
    description: 'Display name for the payment method (max 255 characters)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Display name cannot exceed 255 characters' })
  displayName?: string;
  @ApiProperty({ description: 'Bank name (max 120 characters)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Bank name cannot exceed 120 characters' })
  bankName?: string;
  @ApiProperty({ description: 'Bank code (max 20 characters)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Bank code cannot exceed 20 characters' })
  bankCode?: string;
  @ApiProperty({ description: 'Account holder name (max 160 characters)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'Account holder name cannot exceed 160 characters' })
  accountName?: string;
  @ApiProperty({
    description: 'Bank account number (max 17 digits to support various countries)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(34, { message: 'Account number cannot exceed 34 characters' })
  accountNumber?: string;
  @ApiProperty({ description: 'Country code (2 characters, ISO format)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2, { message: 'Country code must be exactly 2 characters (ISO format)' })
  @MinLength(2, { message: 'Country code must be exactly 2 characters (ISO format)' })
  country?: string;
  @ApiProperty({ description: 'Set as primary payment method', required: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
  @ApiProperty({ description: 'Current member payment passcode for verification' })
  @IsNotEmpty({ message: 'Current passcode is required' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, { message: 'Passcode must be exactly 6 digits' })
  currentPasscode: string;
  @ApiProperty({ description: 'Email OTP proof from POST /auth/otp/verify' })
  @IsNotEmpty({ message: 'Email verification is required' })
  @IsString()
  otpProof: string;
  @ApiProperty({
    description: 'Additional metadata',
    required: false,
    type: PaymentMethodMetadataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentMethodMetadataDto)
  metadata?: PaymentMethodMetadataDto;
}
