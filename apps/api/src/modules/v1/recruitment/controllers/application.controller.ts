import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from 'src/common/decorators';
import { FileService } from 'src/common/services/file.service';
import { RateLimitService } from 'src/common/services/rate-limit.service';
import { TurnstileService } from 'src/common/services/turnstile.service';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { CandidateUploadUrlDto } from '../dto/candidate-upload-url.dto';
import { CreateCandidateDto } from '../dto/index';
import { UpdateCandidateDto } from '../dto/update-candidate.dto';
import { Candidate } from '../entities/candidate.entity';
import { CandidateService } from '../services/candidate.service';
import { JobOpeningService } from '../services/job-opening.service';

@ApiTags('Public Applications')
@Public()
@Controller('jobs')
export class ApplicationController {
  constructor(
    private readonly candidateService: CandidateService,
    private readonly fileService: FileService,
    private readonly jobOpeningService: JobOpeningService,
    private readonly rateLimitService: RateLimitService,
    private readonly turnstileService: TurnstileService,
  ) {}

  private async assertTurnstile(token: string | undefined, ip: string): Promise<void> {
    if (!this.turnstileService.isEnabled()) {
      return;
    }
    const valid = await this.turnstileService.verify(token ?? '', ip);
    if (!valid) {
      throw new BadRequestException('Captcha verification failed');
    }
  }

  @Post(':jobId/apply/upload-url')
  @ApiOperation({ summary: 'Generate a presigned upload URL for candidate resumes/cover-letters' })
  async getUploadUrl(
    @Param('jobId') jobId: string,
    @Body() body: CandidateUploadUrlDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const clientIp = GeoLocationHelper.resolveClientIp(req.headers, req.socket?.remoteAddress, ip);
    const rate = await this.rateLimitService.checkRateLimit(`apply-upload:${clientIp}:${jobId}`, {
      rules: [{ windowMs: 60 * 60 * 1000, maxRequests: 10 }],
    });
    if (!rate.allowed) {
      throw new BadRequestException('Too many upload requests. Please try again later.');
    }

    const job = await this.jobOpeningService.getActiveJob(jobId);
    return this.fileService.generateUploadUrl({
      tenantId: job.tenantId,
      location: body.location,
      originalName: body.originalName,
      contentType: body.contentType,
    });
  }

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
    @Req() req: Request,
    @Ip() ip: string,
  ): Promise<Candidate> {
    const clientIp = ip || req.ip || 'unknown';
    await this.assertTurnstile(createCandidateDto.turnstileToken, clientIp);
    const { turnstileToken: _turnstileToken, ...candidateData } = createCandidateDto;
    return this.candidateService.applyForJob(jobId, candidateData);
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
    return this.candidateService.updateApplication(applicationId, email, updateData);
  }
}
