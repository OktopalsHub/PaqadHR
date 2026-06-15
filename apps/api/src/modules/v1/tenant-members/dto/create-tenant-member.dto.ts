import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { Gender, TenantMemberRole } from 'src/common/enums';
export class CreateTenantMemberDto {
  @IsString()
  @ApiProperty({
    description: 'first name',
    required: false,
    example: 'John',
  })
  @IsOptional()
  firstName?: string;
  @IsString()
  @ApiProperty({
    description: 'last name',
    required: false,
    example: 'Doe',
  })
  @IsOptional()
  lastName?: string;
  @IsString()
  @ApiProperty({
    description: 'middle name',
    required: false,
    example: 'Example Name',
  })
  @IsOptional()
  middleName?: string;
  @IsString()
  @ApiProperty({
    description: 'preferred name',
    required: false,
    example: 'Example Name',
  })
  @IsOptional()
  preferredName?: string;
  @IsString()
  @ApiProperty({
    description: 'phone',
    required: false,
    example: '+1-234-567-8900',
  })
  @IsOptional()
  phone?: string;
  @IsDateString()
  @ApiProperty({
    description: 'date of birth',
    required: false,
    example: '2023-12-01T10:00:00Z',
  })
  @IsOptional()
  dateOfBirth?: Date;
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(Gender)
  @ApiProperty({
    description: 'gender',
    required: false,
  })
  @IsOptional()
  gender?: Gender;
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(TenantMemberRole)
  @ApiProperty({
    description: 'role',
    required: false,
  })
  @IsOptional()
  role?: TenantMemberRole;
  @IsString()
  @ApiProperty({
    description: 'avatar key',
    required: false,
  })
  @IsOptional()
  avatarKey?: string;
}
