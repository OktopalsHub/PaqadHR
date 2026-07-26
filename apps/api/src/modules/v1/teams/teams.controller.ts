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
import { CurrentTenantMember, RequireFeatures } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import { TeamsService } from './teams.service';

@ApiTags('Teams')
@Controller('tenants/:tenantId/teams')
@UseGuards(JwtAuthGuard, TenantMemberGuard)
@RequireFeatures(FeatureAccess.BASIC_HR)
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
  async getTeam(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.teamsService.getTeam(tenantId, id);
  }
  @Post()
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async createTeam(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateTeamDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.teamsService.createTeam(tenantId, member.id, dto);
  }
  @Put(':id')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async updateTeam(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.teamsService.updateTeam(tenantId, id, dto, member.id);
  }
  @Delete(':id')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async deleteTeam(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.teamsService.deleteTeam(tenantId, id, member.id);
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
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async addTeamMember(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: AddTeamMemberDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.teamsService.addTeamMember(tenantId, id, dto, member.id);
  }
  @Put(':id/members/:memberId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async updateTeamMember(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    return this.teamsService.updateTeamMember(tenantId, id, memberId, dto);
  }
  @Delete(':id/members/:memberId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async removeTeamMember(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.teamsService.removeTeamMember(tenantId, id, memberId, member.id);
  }
  @Patch(':id/leader')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async assignTeamLeader(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: { memberId: string },
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.teamsService.assignTeamLeader(tenantId, id, dto.memberId, member.id);
  }
}
