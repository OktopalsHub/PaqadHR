import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class BillingSettingsDto {
  @ApiProperty({ description: 'Billing contact name', example: 'Jane Doe', required: false })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiProperty({
    description: 'Billing contact email',
    example: 'billing@company.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({ description: 'Billing contact phone', required: false })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ description: 'Address line 1', required: false })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiProperty({ description: 'Address line 2', required: false })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty({ description: 'City', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ description: 'Country', required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({
    description: 'Workspace BVN for virtual accounts and compliance',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'BVN must be 11 digits' })
  identityBvn?: string;

  @ApiProperty({
    description: 'Workspace NIN for compliance',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'NIN must be 11 digits' })
  identityNin?: string;
}
