import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamMember } from "../entities/team-member.entity";

@Injectable()
export class TeamMembersRepository extends Repository<TeamMember> {
  constructor(
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
  ) {
    super(teamMemberRepository.target, teamMemberRepository.manager, teamMemberRepository.queryRunner);
  }
  async createTeamMember(data: Partial<TeamMember>): Promise<TeamMember> {
    return super.create(data);
  }
}
