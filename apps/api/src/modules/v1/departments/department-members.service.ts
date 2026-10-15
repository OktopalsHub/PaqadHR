import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivitiesService } from '../activities/services/activities.service';
import { TenantMembersService } from '../tenant-members/tenant-members.service';
import { DepartmentMembersRepository } from './repositories/department-members.repository';
import { DepartmentsRepository } from './repositories/departments.repository';

@Injectable()
export class DepartmentMembersService {
  constructor(
    private readonly departmentsRepository: DepartmentsRepository,
    private readonly departmentMembersRepository: DepartmentMembersRepository,
    private readonly activitiesService: ActivitiesService,
    private readonly tenantMembersService: TenantMembersService,
  ) {}

  async addMemberToDepartment(
    tenantId: string,
    departmentId: string,
    memberId: string,
    actorMemberId: string,
  ) {
    const department = await this.departmentsRepository.findOne({
      where: { id: departmentId, tenantId },
    });
    if (!department) throw new NotFoundException('Department not found');
    if (!(await this.tenantMembersService.memberExistsInTenant(tenantId, memberId))) {
      throw new NotFoundException('Member not found in this workspace');
    }
    const existingMembership = await this.departmentMembersRepository.findOne({
      where: { departmentId, memberId },
    });
    if (existingMembership) {
      throw new NotFoundException('Member is already in this department');
    }
    await this.departmentMembersRepository.save(
      this.departmentMembersRepository.create({
        departmentId,
        memberId,
        role: 'MEMBER',
        joinedAt: new Date(),
        isActive: true,
      }),
    );
    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId,
        action: 'department.member_added',
        resourceType: 'department',
        resourceId: departmentId,
        description: `Added a member to ${department.name}`,
        metadata: { memberId },
      })
      .catch(() => {});
    return { success: true };
  }

  async removeMemberFromDepartment(
    tenantId: string,
    departmentId: string,
    memberId: string,
    actorMemberId: string,
  ) {
    const department = await this.departmentsRepository.findOne({
      where: { id: departmentId, tenantId },
    });
    if (!department) throw new NotFoundException('Department not found');
    const membership = await this.departmentMembersRepository.findOne({
      where: { departmentId, memberId },
    });
    if (!membership) {
      throw new NotFoundException('Member not found in department');
    }
    await this.departmentMembersRepository.delete(membership.id);
    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId,
        action: 'department.member_removed',
        resourceType: 'department',
        resourceId: departmentId,
        description: `Removed a member from ${department.name}`,
        metadata: { memberId },
      })
      .catch(() => {});
    return { success: true };
  }

  async getDepartmentMembers(tenantId: string, departmentId: string) {
    const department = await this.departmentsRepository.findOne({
      where: { id: departmentId, tenantId },
    });
    if (!department) throw new NotFoundException('Department not found');
    const memberships = await this.departmentMembersRepository.find({
      where: { departmentId, isActive: true },
      relations: ['member'],
    });
    return memberships.map((membership) => membership.member);
  }
}
