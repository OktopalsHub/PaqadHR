import { CreateEducationDto } from "../../modules/v1/education/dto/create-education.dto";
import { Education } from "../../modules/v1/education/entities/education.entity";
import { UpdateEducationDto } from "../../modules/v1/education/dto/update-education.dto";

export interface IEducationRepository {
    createEducation(createEducationDto: CreateEducationDto, tenantId: string, tenantMemberId: string): Promise<Education>;
    listEducations(tenantId: string, tenantMemberId?: string): Promise<Education[]>;
    getEducation(id: string, tenantId: string): Promise<Education | null>;
    updateEducation(id: string, updateEducationDto: UpdateEducationDto, tenantId: string): Promise<Education>;
    deleteEducation(id: string, tenantId: string): Promise<void>;
}
