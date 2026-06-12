import { Injectable, NotFoundException } from '@nestjs/common';
import { EducationRepository } from './education.repository';
import { CreateEducationDto } from "./dto/create-education.dto";
import { Education } from "./entities/education.entity";
import { UpdateEducationDto } from "./dto/update-education.dto";

@Injectable()
export class EducationService {
  constructor(private readonly educationRepository: EducationRepository) {}
  async createEducation(
    tenantId: string,
    memberId: string,
    createEducationDto: CreateEducationDto,
  ): Promise<Education> {
    return this.educationRepository.createEducation(
      createEducationDto,
      tenantId,
      memberId,
    );
  }
  async listEducations(
    tenantId: string,
    memberId?: string,
  ): Promise<Education[]> {
    return this.educationRepository.listEducations(tenantId, memberId);
  }
  async getEducation(id: string, tenantId: string): Promise<Education> {
    const education = await this.educationRepository.getEducation(
      id,
      tenantId,
    );
    if (!education) {
      throw new NotFoundException(`Education with ID "${id}" not found`);
    }
    return education;
  }
  async updateEducation(
    id: string,
    updateEducationDto: UpdateEducationDto,
    tenantId: string,
  ): Promise<Education> {
    await this.getEducation(id, tenantId);
    return this.educationRepository.updateEducation(
      id,
      updateEducationDto,
      tenantId,
    );
  }
  async deleteEducation(id: string, tenantId: string): Promise<void> {
    await this.getEducation(id, tenantId);
    return this.educationRepository.deleteEducation(id, tenantId);
  }
  async getEducationsByMemberId(
    memberId: string,
    tenantId: string,
  ): Promise<Education[]> {
    return this.educationRepository.listEducations(tenantId, memberId);
  }
}
