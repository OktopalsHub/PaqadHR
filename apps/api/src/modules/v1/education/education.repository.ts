import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Education } from "./entities/education.entity";
import { CreateEducationDto } from "./dto/create-education.dto";
import { UpdateEducationDto } from "./dto/update-education.dto";
import { IEducationRepository } from "../../../common/interfaces/ieducation-repository.interface";

@Injectable()
export class EducationRepository
  extends Repository<Education>
  implements IEducationRepository
{
  constructor(
    @InjectRepository(Education)
    repository: Repository<Education>,
  ) {
    super(repository.target, repository.manager, repository.queryRunner);
  }
  async createEducation(
    createEducationDto: CreateEducationDto,
    tenantId: string,
    tenantMemberId: string,
  ): Promise<Education> {
    const educationData = {
      ...createEducationDto,
      tenantId,
      tenantMemberId,
    };
    return this.create(educationData);
  }
  async listEducations(
    tenantId: string,
    tenantMemberId?: string,
  ): Promise<Education[]> {
    const where: FindOptionsWhere<Education> = { tenantId };
    if (tenantMemberId) {
      where.tenantMemberId = tenantMemberId;
    }
    return this.find({ withDeleted: false, where: where });
  }
  async getEducation(
    id: string,
    tenantId: string,
  ): Promise<Education | null> {
    const education = await this.findOne({
      where: { id, tenantId } as FindOptionsWhere<Education>,
      withDeleted: false,
    });
    if (!education) {
      throw new NotFoundException(`Education record with ID "${id}" not found`);
    }
    return education;
  }
  async updateEducation(
    id: string,
    updateEducationDto: UpdateEducationDto,
    tenantId: string,
  ): Promise<Education> {
    await this.getEducation(id, tenantId);
    await this.update(id, updateEducationDto);
    const updatedEducation = await this.getEducation(id, tenantId);
    if (!updatedEducation) {
      throw new NotFoundException(`Education record with ID "${id}" not found`);
    }
    return updatedEducation;
  }
  async deleteEducation(id: string, tenantId: string): Promise<void> {
    await this.getEducation(id, tenantId);
    const result = await this.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Education record with ID "${id}" not found`);
    }
  }
}
