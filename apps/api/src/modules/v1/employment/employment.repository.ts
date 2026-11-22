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
      select: {
        id: true,
        startDate: true,
        endDate: true,
        status: true,
        tenantMemberId: true,
        positionId: true,
        tenantId: true,
        reportsToId: true,
        payType: true,
        paySchedule: true,
        payRate: true,
        currency: true,
        comments: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { startDate: 'DESC' },
      withDeleted: false,
    });
  }
  async getEmployment(id: string, tenantId: string): Promise<Employment | null> {
    return this.employmentRepository.findOne({
      where: { id, tenantId },
      relations: { position: true, reportsTo: true, tenantMember: true },
      withDeleted: false,
    });
  }
  async findEmploymentsByMemberId(tenantMemberId: string, tenantId: string): Promise<Employment[]> {
    return this.employmentRepository.find({
      where: { tenantMemberId, tenantId },
      relations: { position: true, reportsTo: true },
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
      relations: { position: true, reportsTo: true },
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
  async replaceCurrentEmployment(
    tenantId: string,
    tenantMemberId: string,
    plan: (current: Employment | null) => { endDate?: Date; next: Partial<Employment> },
  ): Promise<Employment> {
    return this.employmentRepository.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [tenantMemberId]);
      const repository = manager.getRepository(Employment);
      const current = await repository.findOne({
        where: { tenantMemberId, tenantId, endDate: IsNull() },
        withDeleted: false,
        loadEagerRelations: false,
      });
      const { endDate, next } = plan(current);
      if (current && endDate) {
        current.endDate = endDate;
        await repository.save(current);
      }
      return repository.save(repository.create(next));
    });
  }
}
