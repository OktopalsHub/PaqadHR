import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ required: false })
  name?: string;
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @ApiProperty({ required: false })
  issueDate?: Date;
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @ApiProperty({ required: false })
  expiryDate?: Date;
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  description?: string;
}
