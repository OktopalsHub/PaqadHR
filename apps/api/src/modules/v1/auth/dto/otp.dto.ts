import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_MIN_LENGTH_MESSAGE,
} from 'src/common/constants/password-policy.constant';
import { NormalizeEmail } from 'src/common/decorators';

export const OTP_PURPOSES = ['password_change', 'payment_method'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export class SendOtpDto {
  @ApiProperty({ enum: OTP_PURPOSES })
  @IsIn(OTP_PURPOSES)
  purpose: OtpPurpose;
}

export class VerifyOtpDto {
  @ApiProperty({ enum: OTP_PURPOSES })
  @IsIn(OTP_PURPOSES)
  purpose: OtpPurpose;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class VerifyEmailDto {
  @IsEmail()
  @NormalizeEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  code: string;
}

export class ResendEmailVerificationDto {
  @IsEmail()
  @NormalizeEmail()
  email: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  otpProof: string;

  @ApiProperty()
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, { message: PASSWORD_MIN_LENGTH_MESSAGE })
  newPassword: string;
}
