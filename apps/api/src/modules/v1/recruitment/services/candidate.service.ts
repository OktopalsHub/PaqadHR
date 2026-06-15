import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CandidateSource, CandidateStatus } from 'src/common/enums';
import type { CreateCandidateDto } from '../dto/create-candidate.dto';
import type { CreatePipelineCandidateDto } from '../dto/create-pipeline-candidate.dto';
import type { UpdateCandidateDto } from '../dto/update-candidate.dto';
import type { UpdateCandidateStatusDto } from '../dto/update-candidate-status.dto';
import type { Candidate } from '../entities/candidate.entity';
import { CandidateRepository } from '../repositories/index';
import { JobOpeningService } from './job-opening.service';

@Injectable()
export class CandidateService {
  constructor(
    private readonly candidateRepository: CandidateRepository,
    private readonly jobOpeningService: JobOpeningService,
  ) {}
  async createPipelineCandidate(
    tenantId: string,
    memberId: string,
    dto: CreatePipelineCandidateDto,
  ): Promise<Candidate> {
    await this.jobOpeningService.getJob(dto.jobOpeningId, tenantId, memberId);

    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.candidateRepository.findByEmailAndJob(
      normalizedEmail,
      dto.jobOpeningId,
    );
    if (existing) {
      throw new BadRequestException('This candidate has already applied for this role.');
    }

    const entity = this.candidateRepository.create({
      jobOpeningId: dto.jobOpeningId,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email: normalizedEmail,
      phone: dto.phone?.trim() || '',
      resume: {
        filename: 'manual-entry',
        uploadedAt: new Date(),
      },
      status: CandidateStatus.APPLIED,
      currentStage: {
        name: 'Applied',
        startedAt: new Date(),
      },
      tenantId,
      source: dto.source ?? CandidateSource.INTERNAL,
      appliedAt: new Date(),
      location: dto.location,
      portfolioUrl: dto.portfolioUrl,
      linkedinUrl: dto.linkedinUrl,
      skills: dto.skills,
      experience: dto.experience,
    });
    return this.candidateRepository.save(entity);
  }

  async applyForJob(jobId: string, createCandidateDto: CreateCandidateDto): Promise<Candidate> {
    const job = await this.jobOpeningService.getActiveJob(jobId);
    const existingApplication = await this.candidateRepository.findByEmailAndJob(
      createCandidateDto.email,
      jobId,
    );
    if (existingApplication) {
      throw new BadRequestException(
        'You have already applied for this position. You can check your application status or withdraw if needed.',
      );
    }
    const entity = this.candidateRepository.create({
      jobOpeningId: jobId,
      firstName: createCandidateDto.firstName,
      lastName: createCandidateDto.lastName,
      email: createCandidateDto.email,
      phone: createCandidateDto.phone || '',
      resume: {
        filename: createCandidateDto.resumeFilename,
        uploadedAt: new Date(),
      },
      coverLetter: createCandidateDto.coverLetterFilename
        ? {
            filename: createCandidateDto.coverLetterFilename,
            uploadedAt: new Date(),
          }
        : undefined,
      coverLetterText: createCandidateDto.coverLetterText,
      status: CandidateStatus.APPLIED,
      currentStage: {
        name: 'Applied',
        startedAt: new Date(),
      },
      tenantId: job.tenantId,
      appliedAt: new Date(),
      location: createCandidateDto.location,
      portfolioUrl: createCandidateDto.portfolioUrl,
      linkedinUrl: createCandidateDto.linkedinUrl,
      githubUrl: createCandidateDto.githubUrl,
      skills: createCandidateDto.skills,
      experience: createCandidateDto.experience,
    });
    return this.candidateRepository.save(entity);
  }
  async getCandidatesByTenant(tenantId: string): Promise<Candidate[]> {
    return this.candidateRepository.findByTenantOnly(tenantId);
  }
  async getCandidate(candidateId: string, tenantId: string): Promise<Candidate> {
    const candidate = await this.candidateRepository.findByTenantAndId(tenantId, candidateId);
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }
    return candidate;
  }
  async updateCandidateStatus(
    candidateId: string,
    tenantId: string,
    updateDto: UpdateCandidateStatusDto,
  ): Promise<Candidate> {
    await this.getCandidate(candidateId, tenantId);
    const updateData: Record<string, unknown> = {
      status: updateDto.status,
      currentStage: {
        name: updateDto.status,
        startedAt: new Date(),
      },
    };
    if (updateDto.status === CandidateStatus.WITHDRAWN) {
      updateData.withdrawnAt = new Date();
    }
    await this.candidateRepository.update(candidateId, updateData);
    const updatedCandidate = await this.candidateRepository.findOne({
      where: { id: candidateId },
    });
    if (!updatedCandidate) {
      throw new NotFoundException('Candidate not found');
    }
    return updatedCandidate;
  }
  async getCandidatesByJob(jobId: string, tenantId: string): Promise<Candidate[]> {
    return this.candidateRepository.findByJobOpening(jobId, tenantId);
  }
  async getApplicationStatus(applicationId: string, email: string): Promise<Candidate> {
    const candidate = await this.candidateRepository.findByApplicationIdAndEmail(
      applicationId,
      email,
    );
    if (!candidate) {
      throw new NotFoundException('Application not found');
    }
    return candidate;
  }
  async withdrawApplication(applicationId: string, email: string): Promise<Candidate> {
    const candidate = await this.getApplicationStatus(applicationId, email);
    if (candidate.status === CandidateStatus.WITHDRAWN) {
      throw new BadRequestException('Application has already been withdrawn');
    }
    if ([CandidateStatus.HIRED, CandidateStatus.REJECTED].includes(candidate.status)) {
      throw new BadRequestException('Cannot withdraw application in current status');
    }
    const updateData = {
      status: CandidateStatus.WITHDRAWN,
      withdrawnAt: new Date(),
      currentStage: {
        name: 'Withdrawn',
        startedAt: new Date(),
      },
    };
    await this.candidateRepository.update(applicationId, updateData);
    const updatedCandidate = await this.candidateRepository.findOne({
      where: { id: applicationId },
    });
    if (!updatedCandidate) {
      throw new NotFoundException('Application not found');
    }
    return updatedCandidate;
  }
  async updateApplication(
    applicationId: string,
    email: string,
    updateDto: UpdateCandidateDto,
  ): Promise<Candidate> {
    const candidate = await this.getApplicationStatus(applicationId, email);
    if (![CandidateStatus.APPLIED, CandidateStatus.UNDER_REVIEW].includes(candidate.status)) {
      throw new BadRequestException('Application cannot be updated in current status');
    }
    const updateData: Record<string, unknown> = {};
    if (updateDto.phone !== undefined) updateData.phone = updateDto.phone;
    if (updateDto.location !== undefined) updateData.location = updateDto.location;
    if (updateDto.portfolioUrl !== undefined) updateData.portfolioUrl = updateDto.portfolioUrl;
    if (updateDto.linkedinUrl !== undefined) updateData.linkedinUrl = updateDto.linkedinUrl;
    if (updateDto.githubUrl !== undefined) updateData.githubUrl = updateDto.githubUrl;
    if (updateDto.skills !== undefined) updateData.skills = updateDto.skills;
    if (updateDto.experience !== undefined) updateData.experience = updateDto.experience;
    if (updateDto.resumeFilename) {
      updateData.resume = {
        filename: updateDto.resumeFilename,
        uploadedAt: new Date(),
      };
    }
    if (updateDto.coverLetterFilename) {
      updateData.coverLetter = {
        filename: updateDto.coverLetterFilename,
        uploadedAt: new Date(),
      };
    }
    await this.candidateRepository.update(applicationId, updateData);
    const updatedCandidate = await this.candidateRepository.findOne({
      where: { id: applicationId },
    });
    if (!updatedCandidate) {
      throw new NotFoundException('Application not found');
    }
    return updatedCandidate;
  }
}
