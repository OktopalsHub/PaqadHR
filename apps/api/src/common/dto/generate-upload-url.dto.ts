import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { FileUploadLocation } from '../enums/file-upload-location.enum';

export class GenerateUploadUrlDto {
  @IsEnum(FileUploadLocation)
  @ApiProperty({ enum: FileUploadLocation, example: FileUploadLocation.DOCUMENTS })
  location: FileUploadLocation;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'contract.pdf' })
  originalName: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ required: false, example: 'application/pdf' })
  contentType?: string;
}
