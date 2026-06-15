import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CandidateSource } from 'src/common/enums';
import { CandidateExperienceDto, CandidateLocationDto } from './create-candidate.dto';

/** Manual add of an external applicant to a job posting. */
export class CreatePipelineCandidateDto {
  @ApiProperty({ example: 'Jane' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Job posting this applicant is linked to' })
  @IsUUID()
  @IsNotEmpty()
  jobOpeningId: string;

  @ApiPropertyOptional({ example: 'NestJS, PostgreSQL, React' })
  @IsOptional()
  @IsString()
  skills?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  portfolioUrl?: string;

  @ApiPropertyOptional({ enum: CandidateSource })
  @IsOptional()
  @IsEnum(CandidateSource)
  source?: CandidateSource;

  @ApiPropertyOptional({ type: CandidateLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CandidateLocationDto)
  location?: CandidateLocationDto;

  @ApiPropertyOptional({ type: CandidateExperienceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CandidateExperienceDto)
  experience?: CandidateExperienceDto;
}
