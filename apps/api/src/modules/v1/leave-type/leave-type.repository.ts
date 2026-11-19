import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { relationsFromPaths } from 'src/common/utils/find-relations.util';
import { Repository } from 'typeorm';

import { LeaveType } from './entities/leave-type.entity';

@Injectable()
export class LeaveTypeRepository extends Repository<LeaveType> {
  constructor(@InjectRepository(LeaveType) readonly repo: Repository<LeaveType>) {
    super(repo.target, repo.manager, repo.queryRunner);
  }

  async findById(
    id: string,
    includeDeleted = false,
    additionalWhere?: Record<string, unknown>,
    relations?: string[],
  ) {
    return this.findOne({
      where: { id, ...additionalWhere },
      withDeleted: includeDeleted,
      relations: relationsFromPaths(relations),
    });
  }

  async findAll(includeDeleted = false, where?: Record<string, unknown>, relations?: string[]) {
    return this.find({
      withDeleted: includeDeleted,
      where,
      relations: relationsFromPaths(relations),
    });
  }
}
