import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PositionMemberService } from '../position/services/position-member.service';
import { TenantMembersService } from '../tenant-members/tenant-members.service';
import { Tenant } from '../tenants/entities/tenant.entity';
import type { CreateCompensationDto } from './dto/create-compensation.dto';
import type { CreateEmploymentDto } from './dto/create-employment.dto';
import type { UpdateEmploymentDto } from './dto/update-employment.dto';
import { EmploymentRepository } from './employment.repository';
import type { Employment } from './entities/employment.entity';

function subtractOneDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - 1);
  return result;
}

@Injectable()
export class EmploymentService {
  constructor(
    private readonly employmentRepository: EmploymentRepository,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly tenantMembersService: TenantMembersService,
    private readonly positionMemberService: PositionMemberService,
  ) {}
  async createEmployment(
    tenantId: string,
    tenantMemberId: string,
    createdBy: string,
    createEmploymentDto: CreateEmploymentDto,
  ): Promise<Employment> {
    await this.tenantMembersService.getTenantMember(tenantMemberId, tenantId);

    const { positionStartDate: _positionStartDate, ...employmentData } = createEmploymentDto;

    const employment = await this.employmentRepository.createEmployment({
      ...employmentData,
      tenantMemberId,
      tenantId,
      createdBy,
    });

    if (createEmploymentDto.positionId) {
      await this.positionMemberService.assignPosition(
        tenantId,
        tenantMemberId,
        createEmploymentDto.positionId,
        createEmploymentDto.positionStartDate ?? createEmploymentDto.startDate,
      );
    }

    return employment;
  }
  async addCompensationRecord(
    tenantId: string,
    tenantMemberId: string,
    createdBy: string,
    createCompensationDto: CreateCompensationDto,
  ): Promise<Employment> {
    await this.tenantMembersService.getTenantMember(tenantMemberId, tenantId);

    const { effectiveDate, payRate, payType, paySchedule, comments } = createCompensationDto;
    if (payRate <= 0) {
      throw new BadRequestException('Pay rate must be greater than zero');
    }

    const currentEmployment = await this.employmentRepository.getCurrentEmployment(
      tenantMemberId,
      tenantId,
    );

    const inheritedPositionId: string | null | undefined = currentEmployment?.positionId ?? null;
    if (currentEmployment) {
      const endDate = subtractOneDay(effectiveDate);
      if (endDate < currentEmployment.startDate) {
        throw new BadRequestException('Effective date must be after the current salary start date');
      }
      await this.employmentRepository.endCurrentEmployment(tenantMemberId, endDate, tenantId);
    }

    return this.employmentRepository.createEmployment({
      startDate: effectiveDate,
      payRate,
      payType,
      paySchedule,
      comments,
      positionId: inheritedPositionId ?? undefined,
      tenantMemberId,
      tenantId,
      createdBy,
    });
  }
  async listEmployments(tenantId: string): Promise<Employment[]> {
    return this.employmentRepository.listEmployments(tenantId);
  }
  async getEmploymentsByMemberId(tenantId: string, memberId: string): Promise<Employment[]> {
    return this.employmentRepository.findEmploymentsByMemberId(memberId, tenantId);
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
