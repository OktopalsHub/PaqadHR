import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from 'class-validator';
import { RelationshipType } from 'src/common/enums';
export class CreateEmergencyContactDto {
  @IsString()
  @ApiProperty({
    description: 'full name',
    example: 'Example Name',
  })
  @IsNotEmpty()
  fullName: string;
  @IsPhoneNumber()
  @ApiProperty({
    description: 'phone number',
    example: '+1-234-567-8900',
  })
  @IsNotEmpty()
  phoneNumber: string;
  @IsEmail()
  @ApiProperty({
    description: 'email',
    required: false,
    example: 'user@example.com',
    format: 'email',
  })
  @IsOptional()
  email?: string;
  @IsEnum(RelationshipType)
  @ApiProperty({
    description: 'relationship',
  })
  @IsNotEmpty()
  relationship: RelationshipType;
  @IsString()
  @ApiProperty({
    description: 'address',
    required: false,
  })
  @IsOptional()
  address?: string;
  @IsBoolean()
  @ApiProperty({
    description: 'is primary',
    required: false,
    example: true,
  })
  @IsOptional()
  isPrimary?: boolean = false;
}
