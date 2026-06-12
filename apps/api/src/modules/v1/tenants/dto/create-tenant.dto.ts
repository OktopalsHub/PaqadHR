import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
export class CreateTenantDto {
  @ApiProperty({
    description: 'Name of the tenant/organization',
    example: 'Acme Corporation',
    minLength: 3,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name: string;
  @ApiProperty({
    description:
      'Unique slug identifier for the tenant (auto-generated if not provided)',
    example: 'acme-corp',
    required: false,
  })
  @IsString()
  @ApiProperty({
    description: 'slug',
  })
  @IsOptional()
  slug: string;
  @ApiProperty({
    description: 'Employee code prefix for the tenant',
    example: 'EMP',
    required: false,
  })
  @IsString()
  @ApiProperty({
    description: 'employee code',
    required: false,
    example: 'ABC123',
  })
  @IsOptional()
  employeeCode?: string;
  @ApiProperty({
    description: 'Industry sector of the organization',
    example: 'Technology',
    required: false,
  })
  @IsString()
  @ApiProperty({
    description: 'industry',
    required: false,
  })
  @IsOptional()
  industry?: string;
  @ApiProperty({
    description: 'Size of the company',
    example: '50-200',
    enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
    required: false,
  })
  @IsString()
  @ApiProperty({
    description: 'company size',
    required: false,
  })
  @IsOptional()
  companySize?: string;
  @ApiProperty({
    description: 'Location of the organization',
    example: 'San Francisco, CA',
    required: false,
  })
  @IsString()
  @ApiProperty({
    description: 'location',
    required: false,
  })
  @IsOptional()
  location?: string;
}
