import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SetPasscodeDto {
  @ApiProperty({
    description: '6-digit payment passcode',
    example: '123456',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, { message: 'Passcode must be exactly 6 digits' })
  passcode: string;
}

export class VerifyPasscodeDto {
  @ApiProperty({
    description: '6-digit payment passcode',
    example: '123456',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, { message: 'Passcode must be exactly 6 digits' })
  passcode: string;
}

export class ChangePaymentPasscodeDto {
  @ApiProperty({ description: 'Current 6-digit passcode' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, { message: 'Passcode must be exactly 6 digits' })
  currentPasscode: string;

  @ApiProperty({ description: 'New 6-digit passcode' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, { message: 'Passcode must be exactly 6 digits' })
  newPasscode: string;
}
