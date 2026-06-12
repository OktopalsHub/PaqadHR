import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class ValidationTestDto {
  @ApiProperty({ description: 'Required name field' })
  @IsNotEmpty({ message: 'Name is required and cannot be empty' })
  @IsString({ message: 'Name must be a text value' })
  name: string;
  @ApiProperty({ description: 'Required email field' })
  @IsNotEmpty({ message: 'Email is required and cannot be empty' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;
  @ApiPropertyOptional({ description: 'Optional description field' })
  @IsOptional()
  @IsString({ message: 'Description must be a text value' })
  description?: string;
}
