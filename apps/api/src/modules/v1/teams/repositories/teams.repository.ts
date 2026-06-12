import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from "../entities/team.entity";

@Injectable()
export class TeamsRepository extends Repository<Team> {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
  ) {
    super(teamRepository.target, teamRepository.manager, teamRepository.queryRunner);
  }
  async createTeam(data: Partial<Team>): Promise<Team> {
    return super.create(data);
  }
}
