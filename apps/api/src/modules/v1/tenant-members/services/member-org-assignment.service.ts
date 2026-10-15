import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EmploymentStatus } from 'src/common/enums';
import { IsNull, Repository } from 'typeorm';
import { Department } from '../../departments/entities/department.entity';
import { DepartmentMember } from '../../departments/entities/department-member.entity';
import { Employment } from '../../employment/entities/employment.entity';
import { TenantMemberRepository } from '../repositories/tenant-members.repository';
import { MemberReadService } from './member-read.service';

@Injectable()
export class MemberOrgAssignmentService {
  constructor(
    private readonly tenantMemberRepository: TenantMemberRepository,
    @InjectRepository(Employment)
    private readonly employmentRepository: Repository<Employment>,
    @InjectRepository(DepartmentMember)
    private readonly departmentMemberRepository: Repository<DepartmentMember>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    private readonly readService: MemberReadService,
  ) {}

  async updateMemberDepartment(
    tenantId: string,
    memberId: string,
    departmentId: string | null,
  ): Promise<void> {
    const activeMemberships = await this.departmentMemberRepository.find({
      where: { memberId, isActive: true },
      relations: ['department'],
    });
    const tenantMemberships = activeMemberships.filter(
      (membership) => membership.department?.tenantId === tenantId,
    );

    if (!departmentId) {
      for (const membership of tenantMemberships) {
        await this.departmentMemberRepository.delete(membership.id);
      }
      return;
    }

    const department = await this.departmentRepository.findOne({
      where: { id: departmentId, tenantId },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }

    if (tenantMemberships.some((membership) => membership.departmentId === departmentId)) {
      return;
    }

    for (const membership of tenantMemberships) {
      await this.departmentMemberRepository.delete(membership.id);
    }

    const existingMembership = await this.departmentMemberRepository.findOne({
      where: { departmentId, memberId },
    });
    if (existingMembership) {
      await this.departmentMemberRepository.update(existingMembership.id, {
        isActive: true,
        joinedAt: new Date(),
      });
      return;
    }

    await this.departmentMemberRepository.save(
      this.departmentMemberRepository.create({
        departmentId,
        memberId,
        role: 'MEMBER',
        joinedAt: new Date(),
        isActive: true,
      }),
    );
  }

  async updateMemberReportsTo(
    tenantId: string,
    memberId: string,
    reportsToId: string | null,
  ): Promise<void> {
    if (reportsToId === memberId) {
      throw new BadRequestException('A member cannot report to themselves');
    }

    if (reportsToId) {
      const manager = await this.tenantMemberRepository.findOne({
        where: { id: reportsToId, tenantId, isActive: true },
      });
      if (!manager) {
        throw new NotFoundException('Manager not found in this workspace');
      }
    }

    const employment = await this.employmentRepository.findOne({
      where: { tenantMemberId: memberId, tenantId, endDate: IsNull() },
    });

    if (employment) {
      await this.employmentRepository.update(employment.id, {
        reportsToId: reportsToId ?? undefined,
      });
      return;
    }

    if (!reportsToId) {
      return;
    }

    const member = await this.readService.getTenantMember(memberId, tenantId);
    await this.employmentRepository.save(
      this.employmentRepository.create({
        tenantMemberId: memberId,
        tenantId,
        startDate: member.joinDate ?? new Date(),
        payRate: 0,
        reportsToId,
        status: EmploymentStatus.ACTIVE,
      }),
    );
  }
}
