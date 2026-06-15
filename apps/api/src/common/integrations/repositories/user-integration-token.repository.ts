import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserIntegrationToken } from '../entities/user-integration-token.entity';

@Injectable()
export class UserIntegrationTokenRepository extends Repository<UserIntegrationToken> {
  constructor(
    @InjectRepository(UserIntegrationToken) readonly repo: Repository<UserIntegrationToken>,
  ) {
    super(repo.target, repo.manager, repo.queryRunner);
  }
}
