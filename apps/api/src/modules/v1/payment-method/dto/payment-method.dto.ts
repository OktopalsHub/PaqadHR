import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PaymentMethodType } from 'src/common/enums';
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
    description: 'Set as primary payment method',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
  @ApiProperty({
    description: 'Security passcode (exactly 6 digits)',
    example: '123456',
  })
  @IsNotEmpty({ message: 'Passcode is required' })
  @IsString()
  @MinLength(6, { message: 'Passcode must be exactly 6 characters' })
  @MaxLength(6, { message: 'Passcode must be exactly 6 characters' })
  passcode: string;
  @ApiProperty({
    description: 'Additional metadata',
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
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
    description: 'Current passcode for verification',
  })
  @IsNotEmpty({ message: 'Current passcode is required' })
  @IsString()
  currentPasscode: string;
  @ApiProperty({
    description: 'New passcode (optional, exactly 6 digits)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'New passcode must be exactly 6 characters' })
  @MaxLength(6, { message: 'New passcode must be exactly 6 characters' })
  newPasscode?: string;
  @ApiProperty({
    description: 'Additional metadata',
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
export class PasscodeChangeDto {
  @ApiProperty({
    description: 'Current passcode',
  })
  @IsNotEmpty({ message: 'Current passcode is required' })
  @IsString()
  currentPasscode: string;
  @ApiProperty({
    description: 'New passcode (exactly 6 digits)',
  })
  @IsNotEmpty({ message: 'New passcode is required' })
  @IsString()
  @MinLength(6, { message: 'New passcode must be exactly 6 characters' })
  @MaxLength(6, { message: 'New passcode must be exactly 6 characters' })
  newPasscode: string;
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
  passcode: string;
}
