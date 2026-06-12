import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from "../entities/department.entity";

@Injectable()
export class DepartmentsRepository extends Repository<Department> {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {
    super(departmentRepository.target, departmentRepository.manager, departmentRepository.queryRunner);
  }
}
