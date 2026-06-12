import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollAuditLog } from '../entities/payroll-audit.entity';

@Injectable()
export class PayrollAuditLogRepository extends Repository<PayrollAuditLog> {
  constructor(
    @InjectRepository(PayrollAuditLog)
    private readonly payrollAuditLogRepository: Repository<PayrollAuditLog>,
  ) {
    super(payrollAuditLogRepository.target, payrollAuditLogRepository.manager, payrollAuditLogRepository.queryRunner);
  }
  async findByPayrollRunId(payrollRunId: string): Promise<PayrollAuditLog[]> {
    return this.payrollAuditLogRepository.find({
      where: { payrollRunId },
      order: { createdAt: 'DESC' },
    });
  }
  async findByMemberId(memberId: string): Promise<PayrollAuditLog[]> {
    return this.payrollAuditLogRepository.find({
      where: { memberId },
      order: { createdAt: 'DESC' },
    });
  }
}
