import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DepartmentMember } from "../entities/department-member.entity";

@Injectable()
export class DepartmentMembersRepository extends Repository<DepartmentMember> {
  constructor(
    @InjectRepository(DepartmentMember)
    private readonly departmentMemberRepository: Repository<DepartmentMember>,
  ) {
    super(departmentMemberRepository.target, departmentMemberRepository.manager, departmentMemberRepository.queryRunner);
  }
}
