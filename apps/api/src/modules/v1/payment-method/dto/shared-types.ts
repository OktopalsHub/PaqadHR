import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaymentMethodStatus } from '../../../../common/enums/payment-method-status.enum';

/** US bank address required for Bachs USD ACH/Wire/RTP destinations. */
export class BachsBankAddressDto {
  @IsString()
  @MaxLength(120)
  line1!: string;

  @IsString()
  @MaxLength(80)
  city!: string;

  @IsString()
  @MaxLength(40)
  state!: string;

  @IsString()
  @MaxLength(20)
  postalCode!: string;

  @IsString()
  @MaxLength(2)
  country!: string;
}

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

  @IsOptional()
  @ValidateNested()
  @Type(() => BachsBankAddressDto)
  bachsBankAddress?: BachsBankAddressDto;

  // Allow index for service compatibility (Record<string, unknown> assignable) — extra keys stripped by whitelist
  [key: string]: unknown;
}

export class PasscodeChangeDto {
  @ApiProperty({ description: 'Current passcode' })
  @IsNotEmpty({ message: 'Current passcode is required' })
  @IsString()
  currentPasscode: string;
  @ApiProperty({ description: 'New passcode (exactly 6 digits)' })
  @IsNotEmpty({ message: 'New passcode is required' })
  @IsString()
  newPasscode: string;
}

export class SubmitForVerificationDto {
  @ApiProperty({ description: 'Member payment passcode (exactly 6 digits)' })
  @IsNotEmpty({ message: 'Passcode is required' })
  @IsString()
  passcode: string;
  @ApiProperty({ description: 'Email OTP proof from POST /auth/otp/verify' })
  @IsNotEmpty({ message: 'Email verification is required' })
  @IsString()
  otpProof: string;
}

export class SetPrimaryPaymentMethodDto {
  @ApiProperty({ description: 'Member payment passcode (exactly 6 digits)' })
  @IsNotEmpty({ message: 'Passcode is required' })
  @IsString()
  passcode: string;
}

export class VerifyPaymentMethodDto {
  @ApiProperty({ description: 'Verification decision', enum: PaymentMethodStatus })
  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(PaymentMethodStatus)
  status: PaymentMethodStatus;

  @ApiProperty({ description: 'Optional notes (required when rejecting)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class SwitchPaymentTypeDto {
  @ApiProperty({ description: 'Payment method type', enum: ['BANK', 'CRYPTO'] })
  @IsNotEmpty({ message: 'Type is required' })
  @IsString()
  type: string;
  @ApiProperty({ description: 'Security passcode', example: '123456' })
  @IsNotEmpty()
  @IsString()
  passcode: string;
}

export class BankLookupDto {
  @ApiProperty({ description: '10-digit account number', example: '0123456789' })
  @IsString()
  accountNumber!: string;
  @ApiProperty({ description: 'Bank code', example: '058' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  bankCode!: string;
  @ApiProperty({ description: 'Bank name', required: false })
  @IsString()
  @MaxLength(120)
  bankName?: string;
}
