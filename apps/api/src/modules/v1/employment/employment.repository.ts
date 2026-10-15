import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Employment } from './entities/employment.entity';

@Injectable()
export class EmploymentRepository extends Repository<Employment> {
  constructor(
    @InjectRepository(Employment)
    private readonly employmentRepository: Repository<Employment>,
  ) {
    super(
      employmentRepository.target,
      employmentRepository.manager,
      employmentRepository.queryRunner,
    );
  }

  async createEmployment(data: Partial<Employment>): Promise<Employment> {
    const entity = this.create(data);
    return this.save(entity);
  }

  async listEmployments(tenantId: string): Promise<Employment[]> {
    return this.employmentRepository.find({
      where: { tenantId },
      relations: ['position', 'reportsTo', 'tenantMember'],
      order: { startDate: 'DESC' },
      withDeleted: false,
    });
  }
  async getEmployment(id: string, tenantId: string): Promise<Employment | null> {
    return this.employmentRepository.findOne({
      where: { id, tenantId },
      relations: ['position', 'reportsTo', 'tenantMember'],
      withDeleted: false,
    });
  }
  async findEmploymentsByMemberId(tenantMemberId: string, tenantId: string): Promise<Employment[]> {
    return this.employmentRepository.find({
      where: { tenantMemberId, tenantId },
      relations: ['position', 'reportsTo'],
      order: { startDate: 'DESC' },
      withDeleted: false,
    });
  }
  async getCurrentEmployment(tenantMemberId: string, tenantId: string): Promise<Employment | null> {
    return this.employmentRepository.findOne({
      where: {
        tenantMemberId,
        tenantId,
        endDate: IsNull(),
      },
      relations: ['position', 'reportsTo'],
      withDeleted: false,
    });
  }

  async findCurrentEmploymentsByTenantId(tenantId: string): Promise<Employment[]> {
    return this.employmentRepository.find({
      where: {
        tenantId,
        endDate: IsNull(),
      },
      withDeleted: false,
    });
  }
  async updateEmployment(
    id: string,
    updateEmploymentDto: Partial<Employment>,
    tenantId: string,
  ): Promise<Employment> {
    await this.employmentRepository.update(
      { id, tenantId },
      updateEmploymentDto as Parameters<typeof this.employmentRepository.update>[1],
    );
    const updatedEmployment = await this.getEmployment(id, tenantId);
    if (!updatedEmployment) {
      throw new NotFoundException(`Employment with ID "${id}" not found after update`);
    }
    return updatedEmployment;
  }
  async deleteEmployment(id: string, tenantId: string): Promise<void> {
    const result = await this.employmentRepository.delete({ id, tenantId });
    if (result.affected === 0) {
      throw new NotFoundException(`Employment with ID "${id}" not found`);
    }
  }
  async restoreEmployment(id: string, tenantId: string): Promise<void> {
    const result = await this.employmentRepository.restore({ id, tenantId });
    if (result.affected === 0) {
      throw new NotFoundException(`Employment with ID "${id}" not found or could not be restored`);
    }
  }
  async endCurrentEmployment(
    tenantMemberId: string,
    endDate: Date,
    tenantId: string,
  ): Promise<Employment> {
    const currentEmployment = await this.getCurrentEmployment(tenantMemberId, tenantId);
    if (!currentEmployment) {
      throw new NotFoundException(
        `No active employment found for member with ID "${tenantMemberId}"`,
      );
    }
    currentEmployment.endDate = endDate;
    return this.employmentRepository.save(currentEmployment);
  }
}
