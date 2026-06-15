import type { CreateEducationDto } from '../../modules/v1/education/dto/create-education.dto';
import type { UpdateEducationDto } from '../../modules/v1/education/dto/update-education.dto';
import type { Education } from '../../modules/v1/education/entities/education.entity';

export interface IEducationRepository {
  createEducation(
    createEducationDto: CreateEducationDto,
    tenantId: string,
    tenantMemberId: string,
  ): Promise<Education>;
  listEducations(tenantId: string, tenantMemberId?: string): Promise<Education[]>;
  getEducation(id: string, tenantId: string): Promise<Education | null>;
  updateEducation(
    id: string,
    updateEducationDto: UpdateEducationDto,
    tenantId: string,
  ): Promise<Education>;
  deleteEducation(id: string, tenantId: string): Promise<void>;
}
