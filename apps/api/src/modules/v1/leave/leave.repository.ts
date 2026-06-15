import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Leave } from './entities/leave.entity';

@Injectable()
export class LeaveRepository extends Repository<Leave> {
  constructor(@InjectRepository(Leave) readonly repo: Repository<Leave>) {
    super(repo.target, repo.manager, repo.queryRunner);
  }
}
