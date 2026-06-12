import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformUser } from "../entities/platform-user.entity";

@Injectable()
export class PlatformUserRepository extends Repository<PlatformUser> {
  constructor(
    @InjectRepository(PlatformUser)
    private readonly repo: Repository<PlatformUser>,
  ) {
    super(repo.target, repo.manager, repo.queryRunner);
  }
}
