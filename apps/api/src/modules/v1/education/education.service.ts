import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivitiesService } from '../activities/services/activities.service';
import type { CreateEducationDto } from './dto/create-education.dto';
import type { UpdateEducationDto } from './dto/update-education.dto';
import { EducationRepository } from './education.repository';
import type { Education } from './entities/education.entity';

@Injectable()
export class EducationService {
  constructor(
    private readonly educationRepository: EducationRepository,
    private readonly activitiesService: ActivitiesService,
  ) {}
  async createEducation(
    tenantId: string,
    memberId: string,
    createEducationDto: CreateEducationDto,
    actorMemberId?: string,
  ): Promise<Education> {
    const edu = await this.educationRepository.createEducation(
      createEducationDto,
      tenantId,
      memberId,
    );

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'education.created',
          resourceType: 'education',
          resourceId: edu.id,
          description: `Education record created`,
          metadata: {
            institution: createEducationDto.institution,
            title: createEducationDto.title,
          },
        })
        .catch(() => {});
    }

    return edu;
  }
  async listEducations(tenantId: string, memberId?: string): Promise<Education[]> {
    return this.educationRepository.listEducations(tenantId, memberId);
  }
  async getEducation(id: string, tenantId: string): Promise<Education> {
    const education = await this.educationRepository.getEducation(id, tenantId);
    if (!education) {
      throw new NotFoundException(`Education with ID "${id}" not found`);
    }
    return education;
  }
  async updateEducation(
    id: string,
    updateEducationDto: UpdateEducationDto,
    tenantId: string,
    actorMemberId?: string,
  ): Promise<Education> {
    await this.getEducation(id, tenantId);
    const updated = await this.educationRepository.updateEducation(
      id,
      updateEducationDto,
      tenantId,
    );

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'education.updated',
          resourceType: 'education',
          resourceId: id,
          description: `Education record updated`,
          metadata: { updatedFields: Object.keys(updateEducationDto) },
        })
        .catch(() => {});
    }

    return updated;
  }
  async deleteEducation(id: string, tenantId: string, actorMemberId?: string): Promise<void> {
    await this.getEducation(id, tenantId);
    await this.educationRepository.deleteEducation(id, tenantId);

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'education.deleted',
          resourceType: 'education',
          resourceId: id,
          description: `Education record deleted`,
        })
        .catch(() => {});
    }
  }
  async getEducationsByMemberId(memberId: string, tenantId: string): Promise<Education[]> {
    return this.educationRepository.listEducations(tenantId, memberId);
  }
}
