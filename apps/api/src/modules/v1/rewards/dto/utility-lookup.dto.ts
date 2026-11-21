import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class UtilityLookupDto {
  @ApiProperty({ example: 'NG' })
  @IsString()
  @Length(2, 2)
  countryCode!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  billerId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  accountNumber!: string;

  @ApiPropertyOptional({ enum: ['PREPAID', 'POSTPAID'] })
  @IsOptional()
  @IsIn(['PREPAID', 'POSTPAID'])
  serviceType?: string;
}
