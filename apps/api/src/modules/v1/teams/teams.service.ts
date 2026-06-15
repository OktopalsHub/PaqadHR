import { Injectable, NotFoundException } from '@nestjs/common';
import type { FindOptionsWhere } from 'typeorm';
import { TenantMembersService } from '../tenant-members/tenant-members.service';
import type { CreateTeamDto } from './dto/create-team.dto';
import type { UpdateTeamDto } from './dto/update-team.dto';
import type { Team } from './entities/team.entity';
import type { TeamMember } from './entities/team-member.entity';
import { TeamMembersRepository } from './repositories/team-members.repository';
import { TeamsRepository } from './repositories/teams.repository';

@Injectable()
export class TeamsService {
  constructor(
    private readonly teamsRepository: TeamsRepository,
    private readonly teamMembersRepository: TeamMembersRepository,
    private readonly tenantMembersService: TenantMembersService,
  ) {}
  async getTeams(
    tenantId: string,
    query?: { name?: string; departmentId?: string; leadId?: string },
  ) {
    const where: FindOptionsWhere<Team> = { tenantId };
    if (query?.name) where.name = query.name;
    if (query?.departmentId) where.departmentId = query.departmentId;
    if (query?.leadId) where.leadId = query.leadId;
    return this.teamsRepository.find({ where });
  }
  async getTeam(tenantId: string, id: string) {
    const team = await this.teamsRepository.findOne({
      where: { id, tenantId },
    });
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }
  async createTeam(tenantId: string, memberId: string, dto: CreateTeamDto) {
    const { members, ...teamData } = dto;
    const team = await this.teamsRepository.createTeam({
      ...teamData,
      tenantId,
      createdBy: memberId,
    });
    if (members && members.length > 0) {
      for (const memberId of members) {
        await this.teamMembersRepository.create({
          teamId: team.id,
          memberId,
        });
      }
    }
    return team;
  }
  async updateTeam(tenantId: string, id: string, dto: UpdateTeamDto) {
    const _team = await this.getTeam(tenantId, id);
    await this.teamsRepository.update(id, dto);
    return this.teamsRepository.findOne({ where: { id, tenantId } });
  }
  async deleteTeam(tenantId: string, id: string) {
    const _team = await this.getTeam(tenantId, id);
    return this.teamsRepository.delete(id);
  }
  async getTeamMembers(tenantId: string, teamId: string, role?: string) {
    await this.getTeam(tenantId, teamId);
    const where: FindOptionsWhere<TeamMember> = { teamId };
    if (role) where.role = role;
    return this.teamMembersRepository.find({ where });
  }
  async addTeamMember(tenantId: string, teamId: string, dto: { memberId: string; role?: string }) {
    await this.getTeam(tenantId, teamId);
    const member = await this.tenantMembersService.getTenantMember(dto.memberId, tenantId);
    if (!member || member.tenantId !== tenantId) {
      throw new NotFoundException('Member not found');
    }
    return this.teamMembersRepository.create({
      teamId,
      memberId: dto.memberId,
      role: dto.role,
    });
  }
  async updateTeamMember(
    tenantId: string,
    teamId: string,
    memberId: string,
    dto: { role: string },
  ) {
    await this.getTeam(tenantId, teamId);
    const member = await this.teamMembersRepository.findOne({
      where: { teamId, memberId },
    });
    if (!member) throw new NotFoundException('Team member not found');
    return this.teamMembersRepository.update(member.id, { role: dto.role });
  }
  async removeTeamMember(tenantId: string, teamId: string, memberId: string) {
    await this.getTeam(tenantId, teamId);
    const member = await this.teamMembersRepository.findOne({
      where: { teamId, memberId },
    });
    if (!member) throw new NotFoundException('Team member not found');
    return this.teamMembersRepository.delete(member.id);
  }
  async assignTeamLeader(tenantId: string, teamId: string, memberId: string) {
    await this.getTeam(tenantId, teamId);
    const member = await this.tenantMembersService.getTenantMember(memberId, tenantId);
    if (!member || member.tenantId !== tenantId) {
      throw new NotFoundException('Member not found');
    }
    await this.teamsRepository.update(teamId, { leadId: memberId });
    return this.teamsRepository.findOne({ where: { id: teamId, tenantId } });
  }
}
