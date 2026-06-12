import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantMemberRole } from 'src/common/enums';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';
import { LeaveTypeAssignmentService } from '../leave-type-assignment.service';
@Controller('tenants/:tenantId/leave-assignments')
@UseGuards(RoleGuard)
export class LeaveAssignmentController {
  constructor(
    private readonly leaveAssignmentService: LeaveTypeAssignmentService,
  ) {}
  @Post('sync')
  async syncLeaveTypeAssignments(
    @Param('tenantId') tenantId: string,
    @Query('year') year?: number,
  ) {
    return this.leaveAssignmentService.syncAllLeaveTypeAssignments(
      tenantId,
      year,
    );
  }
  @Post('assign-existing')
  @Roles(TenantMemberRole.ADMIN, TenantMemberRole.OWNER)
  async assignExistingLeaveTypes(
    @Param('tenantId') tenantId: string,
    @Query('year') year?: number,
  ) {
    return this.leaveAssignmentService.assignExistingLeaveTypesToUsers(
      tenantId,
      year,
    );
  }
  @Post('assign-leave-type/:leaveTypeId')
  @Roles(TenantMemberRole.ADMIN, TenantMemberRole.OWNER)
  async assignLeaveTypeToAllUsers(
    @Param('tenantId') tenantId: string,
    @Param('leaveTypeId') leaveTypeId: string,
    @Query('year') year?: number,
  ) {
    return this.leaveAssignmentService.assignLeaveTypeToAllUsers(
      tenantId,
      leaveTypeId,
      year,
    );
  }
  @Delete('remove-leave-type/:leaveTypeId')
  @Roles(TenantMemberRole.ADMIN, TenantMemberRole.OWNER)
  async removeLeaveTypeAssignments(
    @Param('tenantId') tenantId: string,
    @Param('leaveTypeId') leaveTypeId: string,
    @Query('year') year?: number,
  ) {
    return this.leaveAssignmentService.removeLeaveTypeAssignments(
      tenantId,
      leaveTypeId,
      year,
    );
  }
  @Get('report')
  @Roles(TenantMemberRole.ADMIN, TenantMemberRole.OWNER)
  async getAssignmentReport(
    @Param('tenantId') tenantId: string,
    @Query('year') year?: number,
  ) {
    return this.leaveAssignmentService.getAssignmentReport(tenantId, year);
  }
}
