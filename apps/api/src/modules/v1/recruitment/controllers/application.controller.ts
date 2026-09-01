import {
  BadRequestException,
  Body,
  Controller,
  Ip,
  Param,
  ParseUUIDPipe,
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
import { ApplicationAccessDto } from '../dto/application-access.dto';
import { CandidateUploadUrlDto } from '../dto/candidate-upload-url.dto';
import { CreateCandidateDto } from '../dto/index';
import {
  PublicApplicationMapper,
  PublicApplicationResponseDto,
} from '../dto/public-application-response.dto';
import { UpdateCandidateDto } from '../dto/update-candidate.dto';
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

  private resolveClientIp(req: Request, ip: string): string {
    return GeoLocationHelper.resolveClientIp(req.headers, req.socket?.remoteAddress, ip);
  }

  private async assertTurnstile(token: string | undefined, ip: string): Promise<void> {
    if (!this.turnstileService.isEnabled()) {
      return;
    }
    const valid = await this.turnstileService.verify(token ?? '', ip);
    if (!valid) {
      throw new BadRequestException('Captcha verification failed');
    }
  }

  private async assertApplicationRateLimit(scope: string, ip: string): Promise<void> {
    const rate = await this.rateLimitService.checkRateLimit(`${scope}:${ip}`, {
      rules: [{ windowMs: 15 * 60 * 1000, maxRequests: 30 }],
    });
    if (!rate.allowed) {
      throw new BadRequestException('Too many requests. Please try again later.');
    }
  }

  @Post(':jobId/apply/upload-url')
  @ApiOperation({ summary: 'Generate a presigned upload URL for candidate resumes/cover-letters' })
  async getUploadUrl(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() body: CandidateUploadUrlDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const clientIp = this.resolveClientIp(req, ip);
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
      contentLength: body.contentLength,
    });
  }

  @Post(':jobId/apply')
  @ApiOperation({ summary: 'Apply for a job opening' })
  @ApiResponse({
    status: 201,
    description: 'Application submitted successfully',
    type: PublicApplicationResponseDto,
  })
  async applyForJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() createCandidateDto: CreateCandidateDto,
    @Req() req: Request,
    @Ip() ip: string,
  ): Promise<PublicApplicationResponseDto> {
    const clientIp = this.resolveClientIp(req, ip);
    await this.assertApplicationRateLimit(`apply:${jobId}`, clientIp);
    await this.assertTurnstile(createCandidateDto.turnstileToken, clientIp);
    const candidate = await this.candidateService.applyForJob(jobId, createCandidateDto);
    return PublicApplicationMapper.toResponse(candidate);
  }

  @Post(':jobId/applications/:applicationId/status')
  @ApiOperation({ summary: 'Get application status (requires applicant email)' })
  @ApiResponse({
    status: 200,
    description: 'Application status retrieved',
    type: PublicApplicationResponseDto,
  })
  async getApplicationStatus(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() body: ApplicationAccessDto,
    @Req() req: Request,
    @Ip() ip: string,
  ): Promise<PublicApplicationResponseDto> {
    const clientIp = this.resolveClientIp(req, ip);
    await this.assertApplicationRateLimit(`apply-status:${applicationId}`, clientIp);
    const candidate = await this.candidateService.getApplicationStatus(
      jobId,
      applicationId,
      body.email,
    );
    return PublicApplicationMapper.toResponse(candidate);
  }

  @Patch(':jobId/applications/:applicationId/withdraw')
  @ApiOperation({ summary: 'Withdraw job application' })
  @ApiResponse({
    status: 200,
    description: 'Application withdrawn successfully',
    type: PublicApplicationResponseDto,
  })
  async withdrawApplication(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() body: ApplicationAccessDto,
    @Req() req: Request,
    @Ip() ip: string,
  ): Promise<PublicApplicationResponseDto> {
    const clientIp = this.resolveClientIp(req, ip);
    await this.assertApplicationRateLimit(`apply-withdraw:${applicationId}`, clientIp);
    const candidate = await this.candidateService.withdrawApplication(
      jobId,
      applicationId,
      body.email,
    );
    return PublicApplicationMapper.toResponse(candidate);
  }

  @Patch(':jobId/applications/:applicationId')
  @ApiOperation({ summary: 'Update job application' })
  @ApiResponse({
    status: 200,
    description: 'Application updated successfully',
    type: PublicApplicationResponseDto,
  })
  async updateApplication(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() updateDto: UpdateCandidateDto & ApplicationAccessDto,
    @Req() req: Request,
    @Ip() ip: string,
  ): Promise<PublicApplicationResponseDto> {
    const clientIp = this.resolveClientIp(req, ip);
    await this.assertApplicationRateLimit(`apply-update:${applicationId}`, clientIp);
    const { email, ...updateData } = updateDto;
    const candidate = await this.candidateService.updateApplication(
      jobId,
      applicationId,
      email,
      updateData,
    );
    return PublicApplicationMapper.toResponse(candidate);
  }
}
