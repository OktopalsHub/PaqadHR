import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DepartmentMember } from "../../departments/entities/department-member.entity";
import { DepartmentInfo } from "../../../../common/interfaces/department-info.interface";

@Injectable()
export class DepartmentUtils {
  constructor(
    @InjectRepository(DepartmentMember)
    private readonly departmentMemberRepository: Repository<DepartmentMember>,
  ) {}
  async getMemberDepartment(
    tenantId: string,
    memberId: string
  ): Promise<DepartmentInfo | null> {
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
    } catch (error) {
      return null;
    }
  }
  formatDepartmentResponse(department: DepartmentInfo | null): string | null {
    return department ? department.name : null;
  }
}
