import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type FindManyOptions, Repository } from 'typeorm';
import { PayrollItem } from '../entities/payroll-item.entity';

@Injectable()
export class PayrollItemRepository extends Repository<PayrollItem> {
  constructor(
    @InjectRepository(PayrollItem)
    private readonly payrollItemRepository: Repository<PayrollItem>,
  ) {
    super(
      payrollItemRepository.target,
      payrollItemRepository.manager,
      payrollItemRepository.queryRunner,
    );
  }
  async findByPayrollRunId(payrollRunId: string, tenantId: string): Promise<PayrollItem[]> {
    return this.createQueryBuilder('item')
      .innerJoin('item.payrollRun', 'run', 'run.tenantId = :tenantId', { tenantId })
      .leftJoinAndSelect('item.employee', 'employee')
      .leftJoinAndSelect('item.deductions', 'deductions')
      .leftJoinAndSelect('item.bonuses', 'bonuses')
      .where('item.payrollRunId = :payrollRunId', { payrollRunId })
      .andWhere('item.deletedAt IS NULL')
      .getMany();
  }
  async findByMemberId(memberId: string, tenantId: string): Promise<PayrollItem[]> {
    return this.createQueryBuilder('item')
      .innerJoin('item.payrollRun', 'run', 'run.tenantId = :tenantId', { tenantId })
      .leftJoinAndSelect('item.payrollRun', 'payrollRun')
      .where('item.memberId = :memberId', { memberId })
      .orderBy('item.createdAt', 'DESC')
      .getMany();
  }
  async paginate(
    options: FindManyOptions<PayrollItem>,
  ): Promise<{ data: PayrollItem[]; total: number }> {
    const [data, total] = await this.payrollItemRepository.findAndCount(options);
    return { data, total };
  }
}
