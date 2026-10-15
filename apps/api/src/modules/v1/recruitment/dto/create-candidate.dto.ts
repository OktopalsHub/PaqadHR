import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsDate,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
export class CandidateLocationDto {
  @ApiPropertyOptional({
    description: 'Preferred city',
    example: 'Lagos',
  })
  @IsOptional()
  @IsString()
  city?: string;
  @ApiPropertyOptional({
    description: 'Preferred country',
    example: 'Nigeria',
  })
  @IsOptional()
  @IsString()
  country?: string;
  @ApiPropertyOptional({
    description: 'Open to remote work',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  remote?: boolean;
}
export class CandidateExperienceDto {
  @ApiProperty({
    description: 'Years of professional experience',
    example: 5,
  })
  @IsNumber()
  @IsNotEmpty()
  years: number;
  @ApiPropertyOptional({
    description: 'Current or most recent job title',
    example: 'Senior Backend Engineer',
  })
  @IsOptional()
  @IsString()
  currentRole?: string;
  @ApiPropertyOptional({
    description: 'Current or most recent company',
    example: 'Nestcoin',
  })
  @IsOptional()
  @IsString()
  currentCompany?: string;
  @ApiPropertyOptional({
    description: 'Expected salary range',
    example: '$100k - $120k',
  })
  @IsOptional()
  @IsString()
  expectedSalary?: string;
  @ApiPropertyOptional({
    description: 'Earliest availability date',
    example: '2025-09-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  availabilityDate?: Date;
}
export class CreateCandidateDto {
  @ApiProperty({
    description: 'First name',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;
  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;
  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
    format: 'email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+2348012345678',
  })
  @IsOptional()
  @IsString()
  phone?: string;
  @ApiProperty({
    description: 'Resume filename (obtained from file upload)',
    example: 'john_doe_resume.pdf',
  })
  @IsString()
  @Transform(({ value }) => {
    if (typeof value === 'object' && value && typeof value.filename === 'string') {
      return value.filename;
    }
    if (typeof value === 'string') {
      return value;
    }
    return value;
  })
  @IsNotEmpty()
  resumeFilename: string;
  @ApiPropertyOptional({
    description: 'Cover letter as plain text (alternative to file upload)',
    example: 'Dear Hiring Manager, I am excited to apply for the Software Engineer position...',
  })
  @IsOptional()
  @IsString()
  coverLetterText?: string;
  @ApiPropertyOptional({
    description: 'Cover letter filename (obtained from file upload)',
    example: 'john_doe_cover_letter.pdf',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (typeof value === 'object' && value && typeof value.filename === 'string') {
      return value.filename;
    }
    if (typeof value === 'string') {
      return value;
    }
    return undefined;
  })
  coverLetterFilename?: string;
  @ApiPropertyOptional({
    description: 'Location preferences',
    type: CandidateLocationDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CandidateLocationDto)
  location?: CandidateLocationDto;
  @ApiPropertyOptional({
    description: 'Portfolio website URL',
    example: 'https://portfolio.com/johndoe',
  })
  @IsOptional()
  @IsUrl()
  portfolioUrl?: string;
  @ApiPropertyOptional({
    description: 'LinkedIn profile URL',
    example: 'https://linkedin.com/in/johndoe',
  })
  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;
  @ApiPropertyOptional({
    description: 'GitHub profile URL',
    example: 'https://github.com/johndoe',
  })
  @IsOptional()
  @IsUrl()
  githubUrl?: string;
  @ApiPropertyOptional({
    description: 'Technical skills and technologies',
    example: 'NestJS, TypeScript, PostgreSQL, React',
  })
  @IsOptional()
  @IsString()
  skills?: string;
  @ApiPropertyOptional({
    description: 'Work experience details',
    type: CandidateExperienceDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CandidateExperienceDto)
  experience?: {
    years: number;
    currentRole?: string;
    currentCompany?: string;
    expectedSalary?: string;
    availabilityDate?: Date;
  };
  @ApiPropertyOptional({
    description: 'Custom questions answers key-value pairs',
    example: { 'salary-expectation': '100k', 'why-join': 'Love the mission' },
  })
  @IsOptional()
  @IsObject()
  customAnswers?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Cloudflare Turnstile response token' })
  @IsOptional()
  @IsString()
  turnstileToken?: string;

  @ApiProperty({
    description: 'Applicant consent to process application data per the privacy policy',
    example: true,
  })
  @IsBoolean()
  @Equals(true, { message: 'You must accept the privacy policy to submit an application' })
  dataProcessingConsent: boolean;
}
