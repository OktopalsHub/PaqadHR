import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceException } from "../entities/attendance-exception.entity";

@Injectable()
export class AttendanceExceptionRepository extends Repository<AttendanceException> {
  constructor(
    @InjectRepository(AttendanceException)
    private readonly attendanceExceptionRepository: Repository<AttendanceException>,
  ) {
    super(attendanceExceptionRepository.target, attendanceExceptionRepository.manager, attendanceExceptionRepository.queryRunner);
  }
}
