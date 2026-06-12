import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentTenantMember } from 'src/common/decorators';
import { MemberContext } from 'src/common/interfaces';
import { TeamsService } from './teams.service';
import { TenantMemberGuard } from "../tenant-members/guards/tenant-members.guards";
import { CreateTeamDto } from "./dto/create-team.dto";
import { UpdateTeamDto } from "./dto/update-team.dto";
import { AddTeamMemberDto } from "./dto/add-team-member.dto";
import { UpdateTeamMemberDto } from "./dto/update-team-member.dto";

@ApiTags('Teams')
@UseGuards(JwtAuthGuard, TenantMemberGuard)
@Controller('tenants/:tenantId/teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}
  @Get()
  async getTeams(
    @Param('tenantId') tenantId: string,
    @Query() query: { name?: string; departmentId?: string; leadId?: string },
  ) {
    return this.teamsService.getTeams(tenantId, query);
  }
  @Get(':id')
  async getTeam(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.teamsService.getTeam(tenantId, id);
  }
  @Post()
  async createTeam(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateTeamDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.teamsService.createTeam(tenantId, member.userId, dto);
  }
  @Put(':id')
    async updateTeam(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamsService.updateTeam(tenantId, id, dto);
  }
  @Delete(':id')
    async deleteTeam(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.teamsService.deleteTeam(tenantId, id);
  }
  @Get(':id/members')
  async getTeamMembers(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Query('role') role?: string,
  ) {
    return this.teamsService.getTeamMembers(tenantId, id, role);
  }
  @Post(':id/members')
    async addTeamMember(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.teamsService.addTeamMember(tenantId, id, dto);
  }
  @Put(':id/members/:memberId')
    async updateTeamMember(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    return this.teamsService.updateTeamMember(tenantId, id, memberId, dto);
  }
  @Delete(':id/members/:memberId')
    async removeTeamMember(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.teamsService.removeTeamMember(tenantId, id, memberId);
  }
  @Patch(':id/leader')
    async assignTeamLeader(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: { memberId: string },
  ) {
    return this.teamsService.assignTeamLeader(tenantId, id, dto.memberId);
  }
}
