import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators';
import { CandidateService } from '../services/candidate.service';
import { Candidate } from "../entities/candidate.entity";
import { CreateCandidateDto } from "../dto/index";
import { UpdateCandidateDto } from "../dto/update-candidate.dto";

@ApiTags('Public Applications')
@Public()
@Controller('jobs')
export class ApplicationController {
  constructor(private readonly candidateService: CandidateService) {}
  @Post(':jobId/apply')
  @ApiOperation({
    summary: 'Apply for a job opening',
    description: `Submit basic application information. Files can be added via PATCH after application creation.
HRM Flow:
1. Submit this form with basic info and optional cover letter text
2. Optionally include resume/cover letter file keys if files were pre-uploaded
3. Use PATCH /jobs/{jobId}/applications/{applicationId} to add/update file information
File Upload Flow:
1. POST /files/upload-url with location: "resumes" or "cover-letters"
2. PUT <presigned-url> to upload file
3. Include fileKey in application creation or update`,
  })
  @ApiResponse({
    status: 201,
    description: 'Application submitted successfully',
    type: Candidate,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - already applied or invalid data',
  })
  async applyForJob(
    @Param('jobId') jobId: string,
    @Body() createCandidateDto: CreateCandidateDto,
  ): Promise<Candidate> {
    return this.candidateService.applyForJob(jobId, createCandidateDto);
  }
  @Get(':jobId/applications/:applicationId/status')
  @ApiOperation({ summary: 'Get application status' })
  @ApiResponse({
    status: 200,
    description: 'Application status retrieved',
    type: Candidate,
  })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async getApplicationStatus(
    @Param('applicationId') applicationId: string,
    @Body('email') email: string,
  ): Promise<Candidate> {
    return this.candidateService.getApplicationStatus(applicationId, email);
  }
  @Patch(':jobId/applications/:applicationId/withdraw')
  @ApiOperation({ summary: 'Withdraw job application' })
  @ApiResponse({
    status: 200,
    description: 'Application withdrawn successfully',
    type: Candidate,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot withdraw application in current status',
  })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async withdrawApplication(
    @Param('applicationId') applicationId: string,
    @Body('email') email: string,
  ): Promise<Candidate> {
    return this.candidateService.withdrawApplication(applicationId, email);
  }
  @Patch(':jobId/applications/:applicationId')
  @ApiOperation({
    summary: 'Update job application',
    description:
      'Update application details including adding resume/cover letter file information after upload',
  })
  @ApiResponse({
    status: 200,
    description: 'Application updated successfully',
    type: Candidate,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot update application in current status',
  })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async updateApplication(
    @Param('applicationId') applicationId: string,
    @Body() updateDto: UpdateCandidateDto & { email: string },
  ): Promise<Candidate> {
    const { email, ...updateData } = updateDto;
    return this.candidateService.updateApplication(
      applicationId,
      email,
      updateData,
    );
  }
}
