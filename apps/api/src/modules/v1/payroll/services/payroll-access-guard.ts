import { ForbiddenException, Injectable } from '@nestjs/common';
import { TenantMemberRole } from '../../../../common/enums';
import { ManagerAccessService } from '../../../../common/services/manager-access.service';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';

@Injectable()
export class PayrollAccessGuard {
  constructor(
    readonly _payrollItemRepository: PayrollItemRepository,
    private readonly managerAccessService: ManagerAccessService,
  ) {}

  isPayrollAdmin(role: string): boolean {
    return role === TenantMemberRole.ADMIN || role === TenantMemberRole.OWNER;
  }

  async assertPayrollMemberAccess(
    tenantId: string,
    targetMemberId: string,
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<void> {
    if (this.isPayrollAdmin(requesterRole) || targetMemberId === requesterMemberId) return;
    const isManager = await this.managerAccessService.isManagerOf(
      tenantId,
      requesterMemberId,
      targetMemberId,
    );
    if (!isManager)
      throw new ForbiddenException(
        'You can only access payroll for yourself or your direct reports',
      );
  }

  async assertManagerOrAdmin(
    tenantId: string,
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<string[]> {
    if (this.isPayrollAdmin(requesterRole)) {
      return [];
    }
    const directReports = await this.managerAccessService.getDirectReportIds(
      tenantId,
      requesterMemberId,
    );
    if (directReports.length === 0) {
      throw new ForbiddenException('Admin or manager access required');
    }
    return directReports;
  }

  async assertTeamAccess(
    runItems: Array<{ memberId: string }>,
    directReports: string[],
  ): Promise<void> {
    const teamItems = runItems.filter((i) => directReports.includes(i.memberId));
    if (teamItems.length === 0) {
      throw new ForbiddenException('No access to this payroll run');
    }
  }

  async filterTeamItemIds(
    runItems: Array<{ id: string; memberId: string }>,
    itemIds: string[],
    directReports: string[],
  ): Promise<void> {
    const invalid = runItems.filter(
      (i) => itemIds.includes(i.id) && !directReports.includes(i.memberId),
    );
    if (invalid.length > 0) {
      throw new ForbiddenException('You can only access payslips for your direct reports');
    }
  }
}
