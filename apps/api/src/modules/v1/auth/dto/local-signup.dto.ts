import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import {
  STRONG_PASSWORD_MESSAGE,
  STRONG_PASSWORD_REGEX,
} from 'src/common/constants/password-policy.constant';
export class LocalSignupDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @ApiProperty({
    description: 'email',
    example: 'user@example.com',
    format: 'email',
  })
  @IsNotEmpty()
  email: string;
  @ApiProperty({
    description: 'User password (min 8 characters)',
    example: 'StrongPassword123!',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MESSAGE })
  password: string;
}
