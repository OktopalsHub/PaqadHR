import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { FileUploadLocation } from 'src/common/enums/file-upload-location.enum';

const CANDIDATE_UPLOAD_LOCATIONS = [FileUploadLocation.RESUMES, FileUploadLocation.COVER_LETTERS];

export class CandidateUploadUrlDto {
  @ApiProperty({ enum: CANDIDATE_UPLOAD_LOCATIONS })
  @IsIn(CANDIDATE_UPLOAD_LOCATIONS)
  location: FileUploadLocation.RESUMES | FileUploadLocation.COVER_LETTERS;

  @ApiProperty({ example: 'resume.pdf' })
  @IsString()
  @IsNotEmpty()
  originalName: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional()
  @IsString()
  contentType?: string;

  @ApiProperty({ description: 'File size in bytes', example: 102400 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contentLength: number;
}
