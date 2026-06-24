import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EmploymentStatus } from 'src/common/enums';
import type { MemberContext } from 'src/common/interfaces';
import { Employment } from 'src/modules/v1/employment/entities/employment.entity';
import { Repository } from 'typeorm';
import { isTenantAdmin } from '../utils/member-access.util';

@Injectable()
export class ManagerAccessService {
  constructor(
    @InjectRepository(Employment)
    private readonly employmentRepository: Repository<Employment>,
  ) {}

  async getDirectReportIds(tenantId: string, managerMemberId: string): Promise<string[]> {
    const rows = await this.employmentRepository.find({
      where: {
        tenantId,
        reportsToId: managerMemberId,
        status: EmploymentStatus.ACTIVE,
      },
      select: ['tenantMemberId'],
    });
    return rows.map((row) => row.tenantMemberId);
  }

  async isManagerOf(
    tenantId: string,
    managerMemberId: string,
    targetMemberId: string,
  ): Promise<boolean> {
    if (managerMemberId === targetMemberId) {
      return false;
    }
    const count = await this.employmentRepository.count({
      where: {
        tenantId,
        tenantMemberId: targetMemberId,
        reportsToId: managerMemberId,
        status: EmploymentStatus.ACTIVE,
      },
    });
    return count > 0;
  }

  async assertAdminOrManagerOf(
    member: MemberContext,
    targetMemberId: string,
    tenantId: string,
  ): Promise<void> {
    if (isTenantAdmin(member)) {
      return;
    }
    const isManager = await this.isManagerOf(tenantId, member.id, targetMemberId);
    if (!isManager) {
      throw new ForbiddenException('Admin or manager access required');
    }
  }

  async assertAdminOrSelfOrManagerOf(
    member: MemberContext,
    targetMemberId: string,
    tenantId: string,
  ): Promise<void> {
    if (isTenantAdmin(member) || member.id === targetMemberId) {
      return;
    }
    const isManager = await this.isManagerOf(tenantId, member.id, targetMemberId);
    if (!isManager) {
      throw new ForbiddenException('You can only access your own records or your direct reports');
    }
  }
}
