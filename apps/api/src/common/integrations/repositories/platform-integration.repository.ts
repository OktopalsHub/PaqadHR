import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformIntegration } from "../entities/platform-integration.entity";

@Injectable()
export class PlatformIntegrationRepository extends Repository<PlatformIntegration> {
  constructor(
    @InjectRepository(PlatformIntegration)
    private readonly repo: Repository<PlatformIntegration>,
  ) {
    super(repo.target, repo.manager, repo.queryRunner);
  }
}
