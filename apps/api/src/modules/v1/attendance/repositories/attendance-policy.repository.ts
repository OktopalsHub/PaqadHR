import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendancePolicy } from "../entities/attendance-policy.entity";

@Injectable()
export class AttendancePolicyRepository extends Repository<AttendancePolicy> {
  constructor(
    @InjectRepository(AttendancePolicy)
    private readonly attendancePolicyRepository: Repository<AttendancePolicy>,
  ) {
    super(attendancePolicyRepository.target, attendancePolicyRepository.manager, attendancePolicyRepository.queryRunner);
  }
}
