import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, RequireFeatures } from 'src/common/decorators';
import { EmploymentType, JobStatus } from 'src/common/enums';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { FeatureAccessGuard } from 'src/common/guards/feature-access.guard';
import type { MemberContext } from 'src/common/interfaces';
import type { JobFilterOptions } from '../../../../common/interfaces/job-filter-options.interface';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { CreateJobOpeningDto } from '../dto/index';
import { UpdateJobOpeningDto } from '../dto/update-job-opening.dto';
import { JobOpening } from '../entities/job-opening.entity';
import { JobOpeningService } from '../services/job-opening.service';

@ApiTags('Job Openings')
@Controller('tenants/:tenantId/jobs')
@UseGuards(TenantMemberGuard, FeatureAccessGuard)
@RequireFeatures(FeatureAccess.RECRUITMENT)
export class JobOpeningController {
  private readonly logger = new Logger(JobOpeningController.name);
  constructor(private readonly jobOpeningService: JobOpeningService) {}
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new job opening' })
  @ApiResponse({
    status: 201,
    description: 'Job opening created successfully',
    type: JobOpening,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data - check required fields and data formats',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        error: { type: 'string', example: 'Baduest' },
        message: {
          type: 'string',
          example: 'title: Title is required and cannot be empty',
        },
        errors: {
          type: 'object',
          example: {
            title: ['Title is required and cannot be empty'],
            experienceLevel: ['Experience Level is required and cannot be empty'],
          },
        },
        traceId: { type: 'string', example: 'uuid-trace-id' },
      },
    },
  })
  async createJob(
    @Param('tenantId') tenantId: string,
    @Body() createJobOpeningDto: CreateJobOpeningDto,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<JobOpening> {
    try {
      return await this.jobOpeningService.createJob(tenantId, member.id, createJobOpeningDto);
    } catch (error) {
      this.logger.error(`Failed to create job opening for tenant ${tenantId}:`, error);
      throw error;
    }
  }
  @Get('departments')
  @ApiOperation({ summary: 'Get departments available for job creation' })
  @ApiResponse({
    status: 200,
    description: 'List of departments',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'uuid-here' },
          name: { type: 'string', example: 'Engineering' },
        },
      },
    },
  })
  async getDepartments(
    @Param('tenantId') tenantId: string,
  ): Promise<{ id: string; name: string }[]> {
    return this.jobOpeningService.getDepartmentsByTenant(tenantId);
  }
  @Get()
  @ApiOperation({ summary: 'Get jobs by tenant with filtering' })
  @ApiQuery({ name: 'status', enum: JobStatus, required: false })
  @ApiQuery({
    name: 'departmentId',
    type: String,
    required: false,
    description: 'Department ID to filter by',
  })
  @ApiQuery({ name: 'employmentType', enum: EmploymentType, required: false })
  @ApiQuery({
    name: 'experienceLevel',
    type: String,
    required: false,
    description: 'Experience level (e.g., "Entry Level", "Mid-Level", "Senior")',
  })
  @ApiQuery({ name: 'location', type: String, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  @ApiQuery({ name: 'isUrgent', type: Boolean, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async getJobsByTenant(
    @Param('tenantId') tenantId: string,
    @Query() filters: JobFilterOptions,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<{ jobs: JobOpening[]; total: number }> {
    return this.jobOpeningService.getJobsByTenant(tenantId, member.id, filters);
  }
  @Get('stats')
  @ApiOperation({ summary: 'Get job statistics for tenant' })
  async getJobStats(@Param('tenantId') tenantId: string): Promise<{
    total: number;
    draft: number;
    active: number;
    inactive: number;
    closed: number;
    archived: number;
  }> {
    return this.jobOpeningService.getJobStats(tenantId);
  }
  @Get(':jobId')
  async getJob(
    @Param('jobId') jobId: string,
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<JobOpening> {
    return this.jobOpeningService.getJob(jobId, tenantId, member.id);
  }
  @Patch(':jobId')
  @ApiOperation({ summary: 'Update a job opening' })
  @ApiResponse({
    status: 200,
    description: 'Job opening updated successfully',
    type: JobOpening,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data - check field formats and constraints',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        error: { type: 'string', example: 'Baduest' },
        message: {
          type: 'string',
          example: 'minimumSalary: Minimum Salary must be a number',
        },
        errors: {
          type: 'object',
          example: {
            minimumSalary: ['Minimum Salary must be a number'],
            maximumSalary: ['Maximum Salary must be greater than minimum salary'],
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Job opening not found' })
  async updateJob(
    @Param('jobId') jobId: string,
    @Param('tenantId') tenantId: string,
    @Body() updateJobOpeningDto: UpdateJobOpeningDto,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<JobOpening> {
    try {
      return await this.jobOpeningService.updateJob(
        jobId,
        tenantId,
        member.id,
        updateJobOpeningDto,
      );
    } catch (error) {
      this.logger.error(`Failed to update job opening ${jobId}:`, error);
      throw error;
    }
  }
  @Delete(':jobId')
  async deleteJob(
    @Param('jobId') jobId: string,
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<void> {
    return this.jobOpeningService.deleteJob(jobId, tenantId, member.id);
  }
  @Patch(':jobId/activate')
  @ApiOperation({ summary: 'Activate a job (make it public)' })
  @ApiResponse({ status: 200, description: 'Job activated successfully' })
  async activateJob(
    @Param('jobId') jobId: string,
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<JobOpening> {
    return this.jobOpeningService.activateJob(jobId, tenantId, member.id);
  }
  @Patch(':jobId/deactivate')
  @ApiOperation({ summary: 'Deactivate a job (hide from public)' })
  @ApiResponse({ status: 200, description: 'Job deactivated successfully' })
  async deactivateJob(
    @Param('jobId') jobId: string,
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<JobOpening> {
    return this.jobOpeningService.deactivateJob(jobId, tenantId, member.id);
  }
  @Patch(':jobId/close')
  @ApiOperation({ summary: 'Close a job (stop accepting applications)' })
  @ApiResponse({ status: 200, description: 'Job closed successfully' })
  async closeJob(
    @Param('jobId') jobId: string,
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<JobOpening> {
    return this.jobOpeningService.closeJob(jobId, tenantId, member.id);
  }
  @Patch(':jobId/archive')
  @ApiOperation({ summary: 'Archive a closed job' })
  @ApiResponse({ status: 200, description: 'Job archived successfully' })
  async archiveJob(
    @Param('jobId') jobId: string,
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<JobOpening> {
    return this.jobOpeningService.archiveJob(jobId, tenantId, member.id);
  }
}
