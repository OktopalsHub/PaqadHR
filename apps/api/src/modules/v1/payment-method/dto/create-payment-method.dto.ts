import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { isCryptoCurrency } from 'src/common/constants/crypto-currencies.constant';
import { PaymentMethodType } from 'src/common/enums';
import { PaymentMethodMetadataDto } from './shared-types';

export class CreatePaymentMethodDto {
  @ApiProperty({
    description: 'Payment method type',
    enum: PaymentMethodType,
    default: PaymentMethodType.BANK,
  })
  @IsOptional()
  @IsEnum(PaymentMethodType)
  type?: PaymentMethodType;
  @ApiProperty({ description: 'Currency code (max 10 characters)', example: 'USD' })
  @IsNotEmpty({ message: 'Currency is required' })
  @IsString()
  @MaxLength(10, { message: 'Currency code cannot exceed 10 characters' })
  currency: string;
  @ApiProperty({
    description: 'Display name for the payment method (max 255 characters)',
    required: false,
    example: 'My Primary Account',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Display name cannot exceed 255 characters' })
  displayName?: string;
  @ApiProperty({
    description: 'Bank name (max 120 characters) - Required for BANK payment method',
    required: true,
    example: 'Chase Bank',
  })
  @ValidateIf((o) => !o.type || o.type === PaymentMethodType.BANK)
  @IsNotEmpty({ message: 'Bank name is required for bank payment method' })
  @IsString()
  @MaxLength(120, { message: 'Bank name cannot exceed 120 characters' })
  bankName?: string;
  @ApiProperty({
    description: 'Bank code (max 20 characters)',
    required: false,
    example: '021000021',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Bank code cannot exceed 20 characters' })
  bankCode?: string;
  @ApiProperty({
    description: 'Account holder name (max 160 characters) - Required for BANK payment method',
    required: true,
    example: 'John Doe',
  })
  @ValidateIf((o) => !o.type || o.type === PaymentMethodType.BANK)
  @IsNotEmpty({ message: 'Account name is required for bank payment method' })
  @IsString()
  @MaxLength(160, { message: 'Account holder name cannot exceed 160 characters' })
  accountName?: string;
  @ApiProperty({
    description:
      'Bank account number (max 17 digits to support various countries) - Required for BANK payment method',
    required: true,
    example: '1234567890',
  })
  @ValidateIf((o) => !o.type || o.type === PaymentMethodType.BANK)
  @IsNotEmpty({ message: 'Account number is required for bank payment method' })
  @IsString()
  @MaxLength(34, { message: 'Account number cannot exceed 34 characters' })
  accountNumber?: string;
  @ApiProperty({
    description: 'Country code (2 characters, ISO format) - Required for BANK payment method',
    required: true,
    example: 'US',
  })
  @ValidateIf((o) => !o.type || o.type === PaymentMethodType.BANK)
  @IsNotEmpty({ message: 'Country is required for bank payment method' })
  @IsString()
  @MaxLength(2, { message: 'Country code must be exactly 2 characters (ISO format)' })
  @MinLength(2, { message: 'Country code must be exactly 2 characters (ISO format)' })
  country?: string;
  @ApiProperty({ description: 'Crypto wallet address', required: false, example: '0xabc123...' })
  @ValidateIf((o) => o.type === PaymentMethodType.CRYPTO || isCryptoCurrency(o.currency))
  @IsNotEmpty({ message: 'Wallet address is required for crypto payment method' })
  @IsString()
  @MaxLength(128)
  walletAddress?: string;
  @ApiProperty({
    description: 'Blockchain network for crypto payouts',
    required: false,
    example: 'Ethereum',
  })
  @ValidateIf((o) => o.type === PaymentMethodType.CRYPTO || isCryptoCurrency(o.currency))
  @IsNotEmpty({ message: 'Network is required for crypto payment method' })
  @IsString()
  @MaxLength(32)
  cryptoNetwork?: string;
  @ApiProperty({ description: 'Set as primary payment method', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
  @ApiProperty({ description: 'Member payment passcode (exactly 6 digits)', example: '123456' })
  @IsNotEmpty({ message: 'Passcode is required' })
  @IsString()
  @MinLength(6, { message: 'Passcode must be exactly 6 characters' })
  @MaxLength(6, { message: 'Passcode must be exactly 6 characters' })
  @Matches(/^\d{6}$/, { message: 'Passcode must be exactly 6 digits' })
  passcode: string;
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
