import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationChannel } from "../entities/integration-channel.entity";

@Injectable()
export class IntegrationChannelRepository extends Repository<IntegrationChannel> {
  constructor(
    @InjectRepository(IntegrationChannel)
    private readonly repo: Repository<IntegrationChannel>,
  ) {
    super(repo.target, repo.manager, repo.queryRunner);
  }
}
