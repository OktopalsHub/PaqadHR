import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from "../entities/attendance.entity";

@Injectable()
export class AttendanceRepository extends Repository<Attendance> {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
  ) {
    super(attendanceRepository.target, attendanceRepository.manager, attendanceRepository.queryRunner);
  }
}
