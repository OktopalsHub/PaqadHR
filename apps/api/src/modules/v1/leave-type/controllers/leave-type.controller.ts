import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember } from 'src/common/decorators';
import type { MemberContext } from 'src/common/interfaces';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import type { CreateLeaveTypeDto } from '../dto/create-leave-type.dto';
import type { UpdateLeaveTypeDto } from '../dto/update-leave-type.dto';
import { LeaveTypeService } from '../leave-type.service';

@ApiTags('Leave Types')
@Controller('tenants/:tenantId/leave-types')
@UseGuards(TenantMemberGuard)
export class LeaveTypeController {
  constructor(private readonly leaveTypeService: LeaveTypeService) {}
  @Post()
  async createLeaveType(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateLeaveTypeDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.leaveTypeService.createLeaveType(tenantId, member.id, dto);
  }
  @Get()
  async listLeaveTypes(@Param('tenantId') tenantId: string) {
    return this.leaveTypeService.listLeaveTypes(tenantId);
  }
  @Get(':typeId')
  async getLeaveType(@Param('tenantId') tenantId: string, @Param('typeId') typeId: string) {
    return this.leaveTypeService.getLeaveType(typeId, tenantId);
  }
  @Patch(':typeId')
  async updateLeaveType(
    @Param('tenantId') tenantId: string,
    @Param('typeId') typeId: string,
    @Body() dto: UpdateLeaveTypeDto,
  ) {
    return this.leaveTypeService.updateLeaveType(typeId, dto, tenantId);
  }
  @Delete(':typeId')
  async deleteLeaveType(@Param('tenantId') tenantId: string, @Param('typeId') typeId: string) {
    await this.leaveTypeService.deleteLeaveType(typeId, tenantId);
  }
}
