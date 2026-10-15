import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { DepartmentInfo } from '../../../../common/interfaces/department-info.interface';
import { DepartmentMember } from '../../departments/entities/department-member.entity';

@Injectable()
export class DepartmentUtils {
  constructor(
    @InjectRepository(DepartmentMember)
    private readonly departmentMemberRepository: Repository<DepartmentMember>,
  ) {}
  async getMemberDepartment(tenantId: string, memberId: string): Promise<DepartmentInfo | null> {
    try {
      const departmentMembership = await this.departmentMemberRepository.findOne({
        where: {
          memberId,
          isActive: true,
          department: {
            tenantId,
          },
        },
        relations: ['department'],
        select: {
          department: {
            id: true,
            name: true,
          },
        },
      });
      if (departmentMembership?.department) {
        return {
          id: departmentMembership.department.id,
          name: departmentMembership.department.name,
        };
      }
      return null;
    } catch (_error) {
      return null;
    }
  }
  async getDepartmentsByMemberIds(
    tenantId: string,
    memberIds: string[],
  ): Promise<Map<string, DepartmentInfo | null>> {
    const map = new Map<string, DepartmentInfo | null>();
    for (const id of memberIds) map.set(id, null);
    if (!memberIds.length) return map;
    try {
      const memberships = await this.departmentMemberRepository.find({
        where: { memberId: In(memberIds), isActive: true, department: { tenantId } },
        relations: ['department'],
        select: { memberId: true, department: { id: true, name: true } },
      });
      for (const m of memberships) {
        if (m.department) map.set(m.memberId, { id: m.department.id, name: m.department.name });
      }
    } catch (_error) {}
    return map;
  }
  formatDepartmentResponse(department: DepartmentInfo | null): string | null {
    return department ? department.name : null;
  }
}
