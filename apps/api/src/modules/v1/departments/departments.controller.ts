import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import type { IPaginatedData } from 'src/common/interfaces/pagination.interface';
import { CreateTeamDto } from '../teams/dto/create-team.dto';
import { TeamsService } from '../teams/teams.service';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { DepartmentResponseDto } from './dto/department-response.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('Departments')
@UseGuards(TenantMemberGuard)
@Controller('tenants/:tenantId/departments')
export class DepartmentsController {
  constructor(
    private readonly departmentsService: DepartmentsService,
    private readonly teamsService: TeamsService,
  ) {}
  @Get()
  @ApiOperation({
    summary: 'Get all departments with members and teams',
    description:
      'Returns a list of departments including their manager, member information, and teams',
  })
  @ApiResponse({
    status: 200,
    description: 'Departments retrieved successfully',
    type: [DepartmentResponseDto],
  })
  async getDepartments(
    @Param('tenantId') tenantId: string,
    @Query('name') name?: string,
    @Query('managerId') managerId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<IPaginatedData<DepartmentResponseDto>> {
    return this.departmentsService.getDepartments(
      tenantId,
      { name, managerId },
      page ? Number(page) : 1,
      limit ? Number(limit) : 100,
    );
  }
  @Get(':id')
  async getDepartment(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.departmentsService.getDepartment(tenantId, id);
  }
  @Post()
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async createDepartment(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateDepartmentDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.departmentsService.createDepartment(tenantId, member.id, dto);
  }
  @Patch(':id')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async updateDepartment(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.departmentsService.updateDepartment(tenantId, id, dto, member.id);
  }
  @Delete(':id')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async deleteDepartment(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.departmentsService.deleteDepartment(tenantId, id, member.id);
  }
  @Get(':id/teams')
  async getDepartmentTeams(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.teamsService.getTeams(tenantId, { departmentId: id });
  }
  @Post(':id/teams')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async createDepartmentTeam(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateTeamDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.teamsService.createTeam(tenantId, member.id, {
      ...dto,
      departmentId: id,
    });
  }
  @Patch(':id/manager')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async assignDepartmentManager(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: { managerId: string },
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.departmentsService.updateDepartment(
      tenantId,
      id,
      { managerId: dto.managerId },
      member.id,
    );
  }
  @Post(':id/members')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async addMemberToDepartment(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: { memberId: string },
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.departmentsService.addMemberToDepartment(tenantId, id, dto.memberId, member.id);
  }
  @Delete(':id/members/:memberId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async removeMemberFromDepartment(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.departmentsService.removeMemberFromDepartment(tenantId, id, memberId, member.id);
  }
  @Get(':id/members')
  async getDepartmentMembers(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.departmentsService.getDepartmentMembers(tenantId, id);
  }
}
