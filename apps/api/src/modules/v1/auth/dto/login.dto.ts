import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { NormalizeEmail } from 'src/common/decorators';
export class LocalLoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    format: 'email',
  })
  @NormalizeEmail()
  @IsEmail()
  @IsNotEmpty()
  email: string;
  @ApiProperty({
    description: 'User password',
    example: 'StrongPassword123!',
  })
  @IsString()
  @ApiProperty({
    description: 'password',
  })
  @IsNotEmpty()
  password: string;
}
