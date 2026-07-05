import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';

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

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  otpProof: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
