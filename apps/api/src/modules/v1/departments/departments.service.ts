import { Injectable, NotFoundException } from '@nestjs/common';
import type { IPaginatedData } from 'src/common/interfaces/pagination.interface';
import { getPaginationSummary } from 'src/common/utils/pagination.util';
import type { FindOptionsWhere } from 'typeorm';
import type { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import type { CreateDepartmentDto } from './dto/create-department.dto';
import type { DepartmentMemberDto, DepartmentResponseDto } from './dto/department-response.dto';
import type { UpdateDepartmentDto } from './dto/update-department.dto';
import type { Department } from './entities/department.entity';
import type { DepartmentMembersRepository } from './repositories/department-members.repository';
import type { DepartmentsRepository } from './repositories/departments.repository';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly departmentsRepository: DepartmentsRepository,
    private readonly departmentMembersRepository: DepartmentMembersRepository,
  ) {}
  async getDepartments(
    tenantId: string,
    query?: { name?: string; managerId?: string },
    page: number = 1,
    limit: number = 10,
  ): Promise<IPaginatedData<DepartmentResponseDto>> {
    const where: FindOptionsWhere<Department> = { tenantId, ...query };
    const total = await this.departmentsRepository.count({ where });
    const departments = await this.departmentsRepository.find({
      where,
      relations: [
        'manager',
        'manager.user',
        'manager.positionHistory',
        'manager.positionHistory.position',
        'departmentMembers',
        'departmentMembers.member',
        'departmentMembers.member.user',
        'departmentMembers.member.positionHistory',
        'departmentMembers.member.positionHistory.position',
        'teams',
        'teams.lead',
        'teams.lead.user',
        'teams.members',
        'teams.members.member',
        'teams.members.member.user',
      ],
      select: {
        id: true,
        name: true,
        description: true,
        managerId: true,
        createdAt: true,
        updatedAt: true,
        manager: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          user: {
            id: true,
            email: true,
          },
          positionHistory: {
            id: true,
            isCurrent: true,
            position: {
              id: true,
              title: true,
            },
          },
        },
        departmentMembers: {
          id: true,
          role: true,
          isActive: true,
          member: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            user: {
              id: true,
              email: true,
            },
            positionHistory: {
              id: true,
              isCurrent: true,
              position: {
                id: true,
                title: true,
              },
            },
          },
        },
        teams: {
          id: true,
          name: true,
          description: true,
          lead: {
            id: true,
            firstName: true,
            lastName: true,
            user: {
              id: true,
              email: true,
            },
          },
          members: {
            id: true,
            role: true,
            member: {
              id: true,
              firstName: true,
              lastName: true,
              user: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    });
    const records = departments.map((department) => {
      const activeMembers = department.departmentMembers?.filter((dm) => dm.isActive) || [];
      const formatMember = (
        member: TenantMember,
        role?: string,
        isManager = false,
      ): DepartmentMemberDto => ({
        id: member.id,
        firstName: member.firstName ?? '',
        lastName: member.lastName ?? '',
        email: member.user?.email ?? '',
        phone: member.phone ?? undefined,
        position: member.positionHistory?.find((p) => p.isCurrent)?.position?.title,
        role: role || member.positionHistory?.find((p) => p.isCurrent)?.position?.title,
        isManager,
      });
      const manager = department.manager ? formatMember(department.manager, 'Manager', true) : null;
      const members = activeMembers
        .filter((dm) => dm.memberId !== department.managerId)
        .map((dm) => formatMember(dm.member, dm.role));
      const teams = (department.teams || []).map((team) => {
        const teamMembers = team.members || [];
        return {
          id: team.id,
          name: team.name,
          description: team.description,
          memberCount: teamMembers.length + (team.lead ? 1 : 0),
          lead: team.lead
            ? {
                id: team.lead.id,
                firstName: team.lead.firstName || '',
                lastName: team.lead.lastName || '',
                email: team.lead.user?.email || '',
                role: 'Team Lead',
              }
            : null,
          members: teamMembers.map((tm) => ({
            id: tm.member.id,
            firstName: tm.member.firstName || '',
            lastName: tm.member.lastName || '',
            email: tm.member.user?.email || '',
            role: tm.role || 'Team Member',
          })),
        };
      });
      return {
        id: department.id,
        name: department.name,
        description: department.description,
        memberCount: members.length + (manager ? 1 : 0),
        manager,
        members,
        teams,
        createdAt: department.createdAt,
        updatedAt: department.updatedAt,
      };
    });
    return getPaginationSummary(records, total, { page, limit }, 'departments');
  }
  async getDepartment(tenantId: string, id: string) {
    const department = await this.departmentsRepository.findOne({
      where: { id, tenantId },
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }
  async createDepartment(tenantId: string, memberId: string, dto: CreateDepartmentDto) {
    const departmentData = {
      ...dto,
      tenantId,
      createdBy: memberId,
    };
    return this.departmentsRepository.create(departmentData);
  }
  async updateDepartment(tenantId: string, id: string, dto: UpdateDepartmentDto) {
    await this.departmentsRepository.update(id, {
      ...dto,
      tenantId,
    });
    return this.departmentsRepository.findOne({ where: { id, tenantId } });
  }
  async deleteDepartment(tenantId: string, id: string) {
    const department = await this.departmentsRepository.findOne({
      where: { id, tenantId },
    });
    if (!department) throw new NotFoundException('Department not found');
    return this.departmentsRepository.delete(id);
  }
  async addMemberToDepartment(tenantId: string, departmentId: string, memberId: string) {
    const department = await this.departmentsRepository.findOne({
      where: { id: departmentId, tenantId },
    });
    if (!department) throw new NotFoundException('Department not found');
    const existingMembership = await this.departmentMembersRepository.findOne({
      where: { departmentId, memberId },
    });
    if (existingMembership) {
      throw new NotFoundException('Member is already in this department');
    }
    await this.departmentMembersRepository.create({
      departmentId,
      memberId,
      role: 'MEMBER',
      joinedAt: new Date(),
      isActive: true,
    });
    return { success: true };
  }
  async removeMemberFromDepartment(tenantId: string, departmentId: string, memberId: string) {
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
