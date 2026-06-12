import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LocationType } from 'src/common/enums';
export class JobLocationDto {
  @ApiProperty({ enum: LocationType, description: 'Type of job location' })
  @IsNotEmpty()
  @IsEnum(LocationType)
  type: LocationType;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  country?: string;
}
