import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { FileUploadLocation } from 'src/common/enums/file-upload-location.enum';

const CANDIDATE_UPLOAD_LOCATIONS = [FileUploadLocation.RESUMES, FileUploadLocation.COVER_LETTERS];

export class CandidateUploadUrlDto {
  @ApiProperty({ enum: CANDIDATE_UPLOAD_LOCATIONS })
  @IsEnum(CANDIDATE_UPLOAD_LOCATIONS)
  location: FileUploadLocation.RESUMES | FileUploadLocation.COVER_LETTERS;

  @ApiProperty({ example: 'resume.pdf' })
  @IsString()
  @IsNotEmpty()
  originalName: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional()
  @IsString()
  contentType?: string;

  @ApiPropertyOptional({ description: 'Cloudflare Turnstile response token' })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
