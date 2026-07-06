import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenantMemberRole } from 'src/common/enums';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { CreateLeavePolicyDto } from './dto/create-leave-policy.dto';
import { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto';
import { LeavePolicyService } from './leave-policy.service';

@ApiTags('Leaves')
@Controller('tenants/:tenantId/leave-policies')
@UseGuards(TenantMemberGuard, TenantRoleGuard)
export class LeavePolicyController {
  constructor(private readonly leavePolicyService: LeavePolicyService) {}
  @Get()
  @Roles(TenantMemberRole.ADMIN, TenantMemberRole.OWNER)
  async getTenantPolicy(@Param('tenantId') tenantId: string) {
    return this.leavePolicyService.getTenantPolicy(tenantId);
  }
  @Put()
  @Roles(TenantMemberRole.ADMIN, TenantMemberRole.OWNER)
  async updateTenantPolicy(@Param('tenantId') tenantId: string, @Body() dto: UpdateLeavePolicyDto) {
    return this.leavePolicyService.updateTenantPolicy(tenantId, dto);
  }
  @Post('custom')
  @Roles(TenantMemberRole.ADMIN, TenantMemberRole.OWNER)
  async createCustomPolicy(@Param('tenantId') tenantId: string, @Body() dto: CreateLeavePolicyDto) {
    return this.leavePolicyService.createCustomPolicy(tenantId, dto);
  }
}
