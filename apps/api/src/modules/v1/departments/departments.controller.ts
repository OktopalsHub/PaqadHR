import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards } from '@nestjs/common';
import { CurrentTenantMember } from 'src/common/decorators';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { MemberContext } from 'src/common/interfaces';
import { IPaginatedData } from 'src/common/interfaces/pagination.interface';
import { TeamsService } from '../teams/teams.service';
import { DepartmentsService } from './departments.service';
import { TenantMemberGuard } from "../tenant-members/guards/tenant-members.guards";
import { DepartmentResponseDto } from "./dto/department-response.dto";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { CreateTeamDto } from "../teams/dto/create-team.dto";

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
    @Query() query: { name?: string; managerId?: string },
    @Query() pagination: PaginationDto,
  ): Promise<IPaginatedData<DepartmentResponseDto>> {
    return this.departmentsService.getDepartments(
      tenantId,
      query,
      pagination.page,
      pagination.limit,
    );
  }
  @Get(':id')
  async getDepartment(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.departmentsService.getDepartment(tenantId, id);
  }
  @Post()
    async createDepartment(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateDepartmentDto,
    @CurrentTenantMember() member: MemberContext
  ) {
    return this.departmentsService.createDepartment(tenantId, member.id, dto);
  }
  @Patch(':id')
    async updateDepartment(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.updateDepartment(tenantId, id, dto);
  }
  @Delete(':id')
    async deleteDepartment(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.departmentsService.deleteDepartment(tenantId, id);
  }
  @Get(':id/teams')
  async getDepartmentTeams(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.teamsService.getTeams(tenantId, { departmentId: id });
  }
  @Post(':id/teams')
    async createDepartmentTeam(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateTeamDto,
    @CurrentTenantMember() member: MemberContext
  ) {
    return this.teamsService.createTeam(tenantId, member.id, {
      ...dto,
      departmentId: id,
    });
  }
  @Patch(':id/manager')
    async assignDepartmentManager(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: { managerId: string },
  ) {
    return this.departmentsService.updateDepartment(tenantId, id, {
      managerId: dto.managerId,
    });
  }
  @Post(':id/members')
    async addMemberToDepartment(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: { memberId: string },
  ) {
    return this.departmentsService.addMemberToDepartment(
      tenantId,
      id,
      dto.memberId,
    );
  }
  @Delete(':id/members/:memberId')
    async removeMemberFromDepartment(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.departmentsService.removeMemberFromDepartment(
      tenantId,
      id,
      memberId,
    );
  }
  @Get(':id/members')
  async getDepartmentMembers(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.departmentsService.getDepartmentMembers(tenantId, id);
  }
}
