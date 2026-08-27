import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NormalizeEmail } from 'src/common/decorators';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'StrongPassword123!', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Must accept terms and privacy policy', example: true })
  @IsBoolean()
  @Equals(true, { message: 'You must accept the terms and privacy policy to register' })
  termsAccepted: boolean;

  @ApiPropertyOptional({ description: 'Privacy policy version accepted', example: '1.0' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  privacyPolicyVersion?: string;
}
