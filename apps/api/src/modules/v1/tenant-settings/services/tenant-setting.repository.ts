import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantSettings } from "../entities/tenant-settings.entity";

@Injectable()
export class TenantSettingRepository extends Repository<TenantSettings> {
  constructor(
    @InjectRepository(TenantSettings)
    repository: Repository<TenantSettings>,
  ) {
    super(repository.target, repository.manager, repository.queryRunner);
  }
}
