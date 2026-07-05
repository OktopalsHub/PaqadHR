import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
export class AcceptInvitationDto {
  @ApiProperty({
    description: 'Invitation token',
    example: 'abc123',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  token: string;
  @ApiProperty({
    description: 'Email address of the invited user',
    example: 'user@example.com',
    format: 'email',
    required: true,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
  @ApiProperty({
    description: 'First name of the user (required for new users)',
    example: 'John',
    required: false,
  })
  @IsString()
  @IsOptional()
  firstName?: string;
  @ApiProperty({
    description: 'Last name of the user (required for new users)',
    example: 'Doe',
    required: false,
  })
  @IsString()
  @IsOptional()
  lastName?: string;
  @ApiProperty({
    description: 'Preferred display name',
    example: 'Johnny',
    required: false,
  })
  @IsString()
  @IsOptional()
  preferredName?: string;
  @ApiProperty({
    description: 'Password for the new account (required only for new users)',
    example: 'securepassword123',
    required: false,
    minLength: 8,
  })
  @IsOptional()
  @ValidateIf((o) => o.password !== undefined && o.password !== null)
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password?: string;
}
