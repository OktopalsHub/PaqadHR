import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
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
import { PaymentMethodStatus } from '../../../../common/enums/payment-method-status.enum';

// M-5: Strict metadata allow-list to prevent mass-assignment / stored XSS (API3)
export class PaymentMethodMetadataDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  walletAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  cryptoNetwork?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  bankCode?: string;

  // Allow index for service compatibility (Record<string, unknown> assignable) — extra keys stripped by whitelist
  [key: string]: unknown;
}

export class CreatePaymentMethodDto {
  @ApiProperty({
    description: 'Payment method type',
    enum: PaymentMethodType,
    default: PaymentMethodType.BANK,
  })
  @IsOptional()
  @IsEnum(PaymentMethodType)
  type?: PaymentMethodType;
  @ApiProperty({
    description: 'Currency code (max 10 characters)',
    example: 'USD',
  })
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
  @MaxLength(160, {
    message: 'Account holder name cannot exceed 160 characters',
  })
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
  @MaxLength(2, {
    message: 'Country code must be exactly 2 characters (ISO format)',
  })
  @MinLength(2, {
    message: 'Country code must be exactly 2 characters (ISO format)',
  })
  country?: string;
  @ApiProperty({
    description: 'Crypto wallet address',
    required: false,
    example: '0xabc123...',
  })
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
  @ApiProperty({
    description: 'Set as primary payment method',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
  @ApiProperty({
    description: 'Member payment passcode (exactly 6 digits)',
    example: '123456',
  })
  @IsNotEmpty({ message: 'Passcode is required' })
  @IsString()
  @MinLength(6, { message: 'Passcode must be exactly 6 characters' })
  @MaxLength(6, { message: 'Passcode must be exactly 6 characters' })
  @Matches(/^\d{6}$/, { message: 'Passcode must be exactly 6 digits' })
  passcode: string;
  @ApiProperty({
    description: 'Email OTP proof from POST /auth/otp/verify',
  })
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
export class UpdatePaymentMethodDto {
  @ApiProperty({
    description: 'Display name for the payment method (max 255 characters)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Display name cannot exceed 255 characters' })
  displayName?: string;
  @ApiProperty({
    description: 'Bank name (max 120 characters)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Bank name cannot exceed 120 characters' })
  bankName?: string;
  @ApiProperty({
    description: 'Bank code (max 20 characters)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Bank code cannot exceed 20 characters' })
  bankCode?: string;
  @ApiProperty({
    description: 'Account holder name (max 160 characters)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160, {
    message: 'Account holder name cannot exceed 160 characters',
  })
  accountName?: string;
  @ApiProperty({
    description: 'Bank account number (max 17 digits to support various countries)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(34, { message: 'Account number cannot exceed 34 characters' })
  accountNumber?: string;
  @ApiProperty({
    description: 'Country code (2 characters, ISO format)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2, {
    message: 'Country code must be exactly 2 characters (ISO format)',
  })
  @MinLength(2, {
    message: 'Country code must be exactly 2 characters (ISO format)',
  })
  country?: string;
  @ApiProperty({
    description: 'Set as primary payment method',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
  @ApiProperty({
    description: 'Current member payment passcode for verification',
  })
  @IsNotEmpty({ message: 'Current passcode is required' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, { message: 'Passcode must be exactly 6 digits' })
  currentPasscode: string;
  @ApiProperty({
    description: 'Email OTP proof from POST /auth/otp/verify',
  })
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

export class PasscodeChangeDto {
  @ApiProperty({
    description: 'Current passcode',
  })
  @IsNotEmpty({ message: 'Current passcode is required' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, { message: 'Passcode must be exactly 6 digits' })
  currentPasscode: string;
  @ApiProperty({
    description: 'New passcode (exactly 6 digits)',
  })
  @IsNotEmpty({ message: 'New passcode is required' })
  @IsString()
  @MinLength(6, { message: 'New passcode must be exactly 6 characters' })
  @MaxLength(6, { message: 'New passcode must be exactly 6 characters' })
  @Matches(/^\d{6}$/, { message: 'Passcode must be exactly 6 digits' })
  newPasscode: string;
}

export class SubmitForVerificationDto {
  @ApiProperty({ description: 'Member payment passcode (exactly 6 digits)' })
  @IsNotEmpty({ message: 'Passcode is required' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, { message: 'Passcode must be exactly 6 digits' })
  passcode: string;

  @ApiProperty({ description: 'Email OTP proof from POST /auth/otp/verify' })
  @IsNotEmpty({ message: 'Email verification is required' })
  @IsString()
  otpProof: string;
}

export class VerifyPaymentMethodDto {
  @ApiProperty({
    description: 'Verification decision',
    enum: [
      PaymentMethodStatus.VERIFIED,
      PaymentMethodStatus.REJECTED,
      PaymentMethodStatus.SUSPENDED,
    ],
  })
  @IsIn([PaymentMethodStatus.VERIFIED, PaymentMethodStatus.REJECTED, PaymentMethodStatus.SUSPENDED])
  status: PaymentMethodStatus;

  @ApiProperty({
    description: 'Verification notes (required when rejecting)',
    required: false,
  })
  @ValidateIf((o) => o.status === PaymentMethodStatus.REJECTED)
  @IsNotEmpty({ message: 'Rejection reason is required' })
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class SwitchPaymentTypeDto {
  @ApiProperty({
    description: 'Payment method type',
    enum: PaymentMethodType,
  })
  @IsEnum(PaymentMethodType)
  type: PaymentMethodType;
  @ApiProperty({
    description: 'Security passcode',
    example: '123456',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Passcode must be exactly 6 digits' })
  passcode: string;
}

export class BankLookupDto {
  @ApiProperty({ description: '10-digit account number', example: '0123456789' })
  @IsString()
  @Matches(/^\d{10}$/, { message: 'Account number must be exactly 10 digits' })
  accountNumber!: string;

  @ApiProperty({ description: 'Bank code', example: '058' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  bankCode!: string;

  @ApiProperty({ description: 'Bank name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;
}
