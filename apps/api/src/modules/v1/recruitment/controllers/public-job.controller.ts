import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators';
import { EmploymentType } from 'src/common/enums';
import { PublicJobFilterDto } from '../dto/public-job-filter.dto';
import { JobOpening } from '../entities/job-opening.entity';
import { JobOpeningService } from '../services/job-opening.service';

@ApiTags('Public Jobs')
@Controller('jobs')
export class PublicJobController {
  constructor(private readonly jobOpeningService: JobOpeningService) {}
  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all active job openings (public)' })
  @ApiQuery({
    name: 'tenantId',
    type: String,
    required: true,
    description: 'Workspace ID — required to scope public job listings',
  })
  @ApiQuery({
    name: 'departmentId',
    type: String,
    required: false,
    description: 'Department ID to filter by',
  })
  @ApiQuery({ name: 'employmentType', enum: EmploymentType, required: false })
  @ApiQuery({ name: 'location', type: String, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({
    status: 200,
    description: 'List of active job openings',
    type: [JobOpening],
  })
  async getActiveJobs(
    @Query() query: PublicJobFilterDto,
  ): Promise<{ jobs: JobOpening[]; total: number }> {
    const { tenantId, ...filters } = query;
    return this.jobOpeningService.getActiveJobs({ ...filters, tenantId });
  }
  @Get('departments/list')
  @Public()
  @ApiOperation({ summary: 'Get list of departments with active jobs' })
  @ApiResponse({
    status: 200,
    description: 'List of departments with active job openings',
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
  async getDepartmentsWithActiveJobs(): Promise<{ id: string; name: string }[]> {
    return this.jobOpeningService.getActiveDepartments();
  }
  @Get('locations/list')
  @Public()
  @ApiOperation({ summary: 'Get list of locations with active jobs' })
  @ApiResponse({
    status: 200,
    description: 'List of unique locations with active job openings',
    type: [String],
  })
  async getLocationsWithActiveJobs(): Promise<string[]> {
    return this.jobOpeningService.getActiveLocations();
  }
  @Get('stats')
  @Public()
  @ApiOperation({ summary: 'Get public job statistics' })
  @ApiResponse({
    status: 200,
    description: 'Public job statistics',
    schema: {
      type: 'object',
      properties: {
        totalActiveJobs: { type: 'number' },
        totalDepartments: { type: 'number' },
        totalLocations: { type: 'number' },
        urgentJobs: { type: 'number' },
        recentJobs: { type: 'number' },
      },
    },
  })
  async getPublicJobStats(): Promise<{
    totalActiveJobs: number;
    totalDepartments: number;
    totalLocations: number;
    urgentJobs: number;
    recentJobs: number;
  }> {
    return this.jobOpeningService.getPublicJobStats();
  }
  @Get('recent')
  @Public()
  @ApiOperation({ summary: 'Get recently published jobs' })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'Number of recent jobs to return (default: 5)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of recently published job openings',
    type: [JobOpening],
  })
  async getRecentJobs(@Query('limit') limit?: number): Promise<JobOpening[]> {
    return this.jobOpeningService.getRecentJobs(limit || 5);
  }
  @Get('urgent')
  @Public()
  @ApiOperation({ summary: 'Get urgent job openings' })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'Number of urgent jobs to return (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of urgent job openings',
    type: [JobOpening],
  })
  async getUrgentJobs(@Query('limit') limit?: number): Promise<JobOpening[]> {
    return this.jobOpeningService.getUrgentJobs(limit || 10);
  }
  @Get('search/suggestions')
  @Public()
  @ApiOperation({
    summary: 'Get search suggestions for job titles and positions',
  })
  @ApiQuery({
    name: 'query',
    type: String,
    required: true,
    description: 'Search query for suggestions',
  })
  @ApiResponse({
    status: 200,
    description: 'List of search suggestions',
    schema: {
      type: 'object',
      properties: {
        titles: { type: 'array', items: { type: 'string' } },
        positions: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async getSearchSuggestions(
    @Query('query') query: string,
  ): Promise<{ titles: string[]; positions: string[] }> {
    return this.jobOpeningService.getSearchSuggestions(query);
  }
  @Get(':jobId')
  @ApiOperation({ summary: 'Get a specific active job opening (public)' })
  @ApiResponse({
    status: 200,
    description: 'Job opening details',
    type: JobOpening,
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found or not available',
  })
  @Public()
  async getActiveJob(@Param('jobId', ParseUUIDPipe) jobId: string): Promise<JobOpening> {
    return this.jobOpeningService.getActiveJob(jobId);
  }
}
