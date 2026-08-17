import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ActivitiesService } from '../activities/services/activities.service';
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
    private readonly activitiesService: ActivitiesService,
  ) {}
  async createEmployment(
    tenantId: string,
    tenantMemberId: string,
    createdBy: string,
    createEmploymentDto: CreateEmploymentDto,
  ): Promise<Employment> {
    await this.tenantMembersService.getTenantMember(tenantMemberId, tenantId);

    const { positionStartDate: _positionStartDate, ...employmentData } = createEmploymentDto;
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    const currency = (
      (employmentData as { currency?: string }).currency ||
      tenant?.preferredCurrency ||
      'USD'
    ).toUpperCase();

    const employment = await this.employmentRepository.createEmployment({
      ...employmentData,
      currency,
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

    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: createdBy,
        action: 'employment.created',
        resourceType: 'employment',
        resourceId: employment.id,
        description: `Employment record created`,
        metadata: {
          tenantMemberId,
          payRate: employmentData.payRate,
          payType: employmentData.payType,
          currency,
        },
      })
      .catch(() => {});

    return employment;
  }
  async addCompensationRecord(
    tenantId: string,
    tenantMemberId: string,
    createdBy: string,
    createCompensationDto: CreateCompensationDto,
  ): Promise<Employment> {
    await this.tenantMembersService.getTenantMember(tenantMemberId, tenantId);

    const { effectiveDate, payRate, payType, paySchedule, comments, currency } =
      createCompensationDto;
    if (payRate <= 0) {
      throw new BadRequestException('Pay rate must be greater than zero');
    }

    const currentEmployment = await this.employmentRepository.getCurrentEmployment(
      tenantMemberId,
      tenantId,
    );

    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    const salaryCurrency = (
      currency ||
      currentEmployment?.currency ||
      tenant?.preferredCurrency ||
      'USD'
    ).toUpperCase();

    const inheritedPositionId: string | null | undefined = currentEmployment?.positionId ?? null;
    if (currentEmployment) {
      const endDate = subtractOneDay(effectiveDate);
      if (endDate < currentEmployment.startDate) {
        throw new BadRequestException('Effective date must be after the current salary start date');
      }
      await this.employmentRepository.endCurrentEmployment(tenantMemberId, endDate, tenantId);
    }

    const newEmployment = await this.employmentRepository.createEmployment({
      startDate: effectiveDate,
      payRate,
      payType,
      paySchedule,
      comments,
      currency: salaryCurrency,
      positionId: inheritedPositionId ?? undefined,
      tenantMemberId,
      tenantId,
      createdBy,
    });

    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: createdBy,
        action: 'employment.compensation_updated',
        resourceType: 'employment',
        resourceId: newEmployment.id,
        description: `Compensation record added`,
        metadata: {
          tenantMemberId,
          payRate,
          payType,
          paySchedule,
          currency: salaryCurrency,
          effectiveDate,
        },
      })
      .catch(() => {});

    return newEmployment;
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
    actorMemberId?: string,
  ): Promise<Employment> {
    await this.getEmployment(id, tenantId);
    const updated = await this.employmentRepository.updateEmployment(
      id,
      updateEmploymentDto,
      tenantId,
    );

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'employment.updated',
          resourceType: 'employment',
          resourceId: id,
          description: `Employment record updated`,
          metadata: { updatedFields: Object.keys(updateEmploymentDto) },
        })
        .catch(() => {});
    }

    return updated;
  }
  async deleteEmployment(id: string, tenantId: string, actorMemberId?: string): Promise<void> {
    await this.getEmployment(id, tenantId);
    await this.employmentRepository.deleteEmployment(id, tenantId);

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'employment.deleted',
          resourceType: 'employment',
          resourceId: id,
          description: `Employment record deleted`,
        })
        .catch(() => {});
    }
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
    const currency = (employment.currency || tenant?.preferredCurrency || 'USD').toUpperCase();
    return {
      employment,
      baseSalary: employment.payRate,
      payType: employment.payType,
      paySchedule: employment.paySchedule,
      currency,
    };
  }

  async countActiveEmploymentsWithCurrency(tenantId: string, currency: string): Promise<number> {
    return this.employmentRepository.count({
      where: {
        tenantId,
        currency: currency.toUpperCase(),
        endDate: IsNull(),
      },
    });
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
      } catch {}
    }
    return salaryMap;
  }

  async getCurrentSalariesForTenant(tenantId: string): Promise<
    Array<{
      memberId: string;
      payRate: number;
      payType: string;
      paySchedule: string;
      currency: string;
    }>
  > {
    const employments = await this.employmentRepository.findCurrentEmploymentsByTenantId(tenantId);
    return employments.map((employment) => ({
      memberId: employment.tenantMemberId,
      payRate: Number(employment.payRate),
      payType: employment.payType,
      paySchedule: employment.paySchedule,
      currency: (employment.currency || 'USD').toUpperCase(),
    }));
  }
}
