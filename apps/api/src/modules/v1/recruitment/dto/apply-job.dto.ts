import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
export class ApplyJobDto {
  @ApiProperty({ description: 'First name of the candidate' })
  @IsNotEmpty()
  @IsString()
  firstName: string;
  @ApiProperty({ description: 'Last name of the candidate' })
  @IsNotEmpty()
  @IsString()
  lastName: string;
  @ApiProperty({ description: 'Email address of the candidate' })
  @IsNotEmpty()
  @IsEmail()
  email: string;
  @ApiProperty({
    description: 'Phone number of the candidate',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;
  @ApiProperty({ description: 'Location of the candidate', required: false })
  @IsOptional()
  @IsString()
  location?: string;
  @ApiProperty({ description: 'Cover letter', required: false })
  @IsOptional()
  @IsString()
  coverLetter?: string;
  @ApiProperty({ description: 'Resume/CV file URL' })
  @IsNotEmpty()
  @IsString()
  resumeUrl: string;
  @ApiProperty({ description: 'Portfolio URL', required: false })
  @IsOptional()
  @IsUrl()
  portfolioUrl?: string;
  @ApiProperty({ description: 'LinkedIn profile URL', required: false })
  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;
  @ApiProperty({ description: 'GitHub profile URL', required: false })
  @IsOptional()
  @IsUrl()
  githubUrl?: string;
  @ApiProperty({ description: 'Skills and qualifications', required: false })
  @IsOptional()
  @IsString()
  skills?: string;
  @ApiProperty({ description: 'Years of experience', required: false })
  @IsOptional()
  @IsNumber()
  experience?: number;
  @ApiProperty({ description: 'Current role', required: false })
  @IsOptional()
  @IsString()
  currentRole?: string;
  @ApiProperty({ description: 'Current company', required: false })
  @IsOptional()
  @IsString()
  currentCompany?: string;
  @ApiProperty({ description: 'Expected salary', required: false })
  @IsOptional()
  @IsString()
  expectedSalary?: string;
  @ApiProperty({ description: 'Availability date', required: false })
  @IsOptional()
  @IsDateString()
  availabilityDate?: string;
  @ApiProperty({ description: 'Remote work preference', required: false })
  @IsOptional()
  @IsBoolean()
  remotePreference?: boolean;
}
