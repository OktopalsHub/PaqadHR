import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_MIN_LENGTH_MESSAGE,
} from 'src/common/constants/password-policy.constant';
import { NormalizeEmail } from 'src/common/decorators';

import { SignupAttributionDto } from './signup-attribution.dto';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', minLength: MIN_PASSWORD_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MinLength(MIN_PASSWORD_LENGTH, { message: PASSWORD_MIN_LENGTH_MESSAGE })
  password: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  @Equals(true, { message: 'You must accept the terms and privacy policy to register' })
  termsAccepted: boolean;

  @ApiPropertyOptional({ type: SignupAttributionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SignupAttributionDto)
  attribution?: SignupAttributionDto;
}
