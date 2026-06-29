import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CompleteOnboardingDto {
  @ApiProperty({ example: 'Acme Corporation', minLength: 2 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiProperty({
    example: 'acme-corp',
    required: false,
    description: 'Workspace URL slug (auto-generated if omitted)',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(25)
  slug?: string;

  @ApiProperty({ example: 'Technology', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  industry?: string;

  @ApiProperty({ example: '1-10', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  companySize?: string;

  @ApiProperty({
    example: 'NG',
    required: false,
    description: 'ISO-2 business country for pricing lock',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  businessCountry?: string;

  @ApiProperty({ example: 'Jane', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @ApiProperty({ example: 'Jane', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  preferredName?: string;

  @ApiProperty({ example: 'Head of People', minLength: 2 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  jobTitle: string;

  @ApiProperty({
    example: 'starter',
    required: false,
    description: 'Trial plan slug selected during onboarding',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  planSlug?: string;

  @ApiProperty({
    example: 'ZPR',
    required: false,
    description: 'Custom tenant code / employee code prefix',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  employeeCode?: string;
}
