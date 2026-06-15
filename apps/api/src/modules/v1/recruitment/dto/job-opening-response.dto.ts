import { ApiProperty } from '@nestjs/swagger';
import { EmploymentType, JobStatus, LocationType } from 'src/common/enums';
import type { ITenantMemberResponseDto } from '../../../../common/interfaces/itenant-member-response-dto.interface';
import { TenantMemberMapper } from '../../tenant-members/dto/tenant-member-response.dto';
import type { JobOpening } from '../entities/job-opening.entity';

export class JobLocationResponseDto {
  @ApiProperty({ enum: LocationType })
  type: LocationType;
  @ApiProperty({ required: false })
  address?: string;
  @ApiProperty({ required: false })
  city?: string;
  @ApiProperty({ required: false })
  country?: string;
}
export class JobOpeningResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  title: string;
  @ApiProperty({ required: false })
  departmentId?: string | null;
  @ApiProperty({ required: false })
  departmentName?: string;
  @ApiProperty()
  position: string;
  @ApiProperty({ enum: EmploymentType })
  employmentType: EmploymentType;
  @ApiProperty()
  experienceLevel: string;
  @ApiProperty({ type: JobLocationResponseDto })
  location: JobLocationResponseDto;
  @ApiProperty()
  description: string;
  @ApiProperty({ type: [String] })
  requirements: string[];
  @ApiProperty({ type: [String] })
  responsibilities: string[];
  @ApiProperty({ type: [String], required: false })
  preferredQualifications?: string[];
  @ApiProperty({ type: [String], required: false })
  requiredSkills?: string[];
  @ApiProperty({ required: false })
  minimumSalary?: number;
  @ApiProperty({ required: false })
  maximumSalary?: number;
  @ApiProperty({ required: false })
  currency?: string;
  @ApiProperty({ type: [String], required: false })
  benefits?: string[];
  @ApiProperty({ enum: JobStatus })
  status: JobStatus;
  @ApiProperty()
  isUrgent: boolean;
  @ApiProperty({ required: false })
  publishedAt?: Date;
  @ApiProperty({ required: false })
  applicationDeadline?: Date;
  @ApiProperty({ required: false })
  numberOfOpenings?: number;
  @ApiProperty({ required: false })
  createdBy?: ITenantMemberResponseDto;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
  constructor(jobOpening: JobOpening) {
    this.id = jobOpening.id;
    this.title = jobOpening.title;
    this.departmentId = jobOpening.departmentId;
    this.position = jobOpening.position;
    this.employmentType = jobOpening.employmentType;
    this.experienceLevel = jobOpening.experienceLevel;
    this.location = jobOpening.location;
    this.description = jobOpening.description;
    this.requirements = jobOpening.requirements;
    this.responsibilities = jobOpening.responsibilities;
    this.preferredQualifications = jobOpening.preferredQualifications;
    this.requiredSkills = jobOpening.requiredSkills;
    this.minimumSalary = jobOpening.minimumSalary;
    this.maximumSalary = jobOpening.maximumSalary;
    this.currency = jobOpening.currency;
    this.benefits = jobOpening.benefits;
    this.status = jobOpening.status;
    this.isUrgent = jobOpening.isUrgent;
    this.publishedAt = jobOpening.publishedAt;
    this.applicationDeadline = jobOpening.applicationDeadline;
    this.numberOfOpenings = jobOpening.numberOfOpenings;
    this.createdAt = jobOpening.createdAt;
    this.updatedAt = jobOpening.updatedAt;
    if (jobOpening.department) {
      this.departmentName = jobOpening.department.name;
    }
    if (jobOpening.createdBy) {
      this.createdBy = TenantMemberMapper.toResponse(jobOpening.createdBy);
    }
  }
}
