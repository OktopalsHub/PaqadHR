import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Gender } from 'src/common/enums';

export class UpdateMemberProfileDto {
  @ApiProperty({ required: false, example: 'Jane' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiProperty({ required: false, example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({ required: false, example: 'Janey' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  preferredName?: string;

  @ApiProperty({ required: false, example: '+1-234-567-8900' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, example: '1990-01-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ required: false, description: 'Avatar storage key from presigned upload' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  avatarKey?: string;
}
