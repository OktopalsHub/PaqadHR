import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import type { CreateEmploymentDto } from './dto/create-employment.dto';
import type { UpdateEmploymentDto } from './dto/update-employment.dto';
import type { EmploymentRepository } from './employment.repository';
import type { Employment } from './entities/employment.entity';

@Injectable()
export class EmploymentService {
  constructor(
    private readonly employmentRepository: EmploymentRepository,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}
  async createEmployment(
    tenantId: string,
    tenantMemberId: string,
    createdBy: string,
    createEmploymentDto: CreateEmploymentDto,
  ): Promise<Employment> {
    return this.employmentRepository.create({
      ...createEmploymentDto,
      tenantMemberId,
      tenantId,
      createdBy,
    });
  }
  async listEmployments(tenantId: string): Promise<Employment[]> {
    return this.employmentRepository.listEmployments(tenantId);
  }
  async getEmploymentsByMemberId(tenantId: string, memberId: string): Promise<Employment[]> {
    return this.employmentRepository.findEmploymentsByMemberId(tenantId, memberId);
  }
  async getEmployment(id: string, tenantId: string): Promise<Employment> {
    const employment = await this.employmentRepository.getEmployment(id, tenantId);
    if (!employment) {
      throw new NotFoundException(`Employment with ID "${id}" not found`);
    }
    return employment;
  }
  async updateEmployment(
    id: string,
    updateEmploymentDto: UpdateEmploymentDto,
    tenantId: string,
  ): Promise<Employment> {
    await this.getEmployment(id, tenantId);
    return this.employmentRepository.updateEmployment(id, updateEmploymentDto, tenantId);
  }
  async deleteEmployment(id: string, tenantId: string): Promise<void> {
    await this.getEmployment(id, tenantId);
    await this.employmentRepository.deleteEmployment(id, tenantId);
  }
  async getCurrentEmployment(tenantMemberId: string, tenantId: string): Promise<Employment> {
    const employment = await this.employmentRepository.getCurrentEmployment(
      tenantMemberId,
      tenantId,
    );
    if (!employment) {
      throw new NotFoundException(
        `No active employment found for member with ID "${tenantMemberId}"`,
      );
    }
    return employment;
  }
  async getEmploymentSalaryInfo(
    tenantMemberId: string,
    tenantId: string,
  ): Promise<{
    employment: Employment;
    baseSalary: number;
    payType: string;
    paySchedule: string;
    currency: string;
  }> {
    const employment = await this.getCurrentEmployment(tenantMemberId, tenantId);
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    const currency = tenant?.preferredCurrency || 'USD';
    return {
      employment,
      baseSalary: employment.payRate,
      payType: employment.payType,
      paySchedule: employment.paySchedule,
      currency,
    };
  }
  async getBulkEmploymentSalaryInfo(
    tenantMemberIds: string[],
    tenantId: string,
  ): Promise<
    Map<
      string,
      {
        employment: Employment;
        baseSalary: number;
        payType: string;
        paySchedule: string;
        currency: string;
      }
    >
  > {
    const salaryMap = new Map();
    for (const memberId of tenantMemberIds) {
      try {
        const salaryInfo = await this.getEmploymentSalaryInfo(memberId, tenantId);
        salaryMap.set(memberId, salaryInfo);
      } catch (error) {
        console.warn(`Could not get salary info for employee ${memberId}:`, error.message);
      }
    }
    return salaryMap;
  }
}
