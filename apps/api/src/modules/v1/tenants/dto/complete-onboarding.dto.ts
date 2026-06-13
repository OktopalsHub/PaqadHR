import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CompleteOnboardingDto {
  @ApiProperty({ example: 'Acme Corporation', minLength: 2 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

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
}
