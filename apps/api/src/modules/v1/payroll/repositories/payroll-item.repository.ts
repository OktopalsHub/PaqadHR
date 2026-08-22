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
  async findByPayrollRunId(payrollRunId: string): Promise<PayrollItem[]> {
    return this.find({
      withDeleted: false,
      where: { payrollRunId },
      relations: ['employee', 'deductions', 'bonuses'],
    });
  }
  async findByMemberId(memberId: string): Promise<PayrollItem[]> {
    return this.payrollItemRepository.find({
      where: { memberId },
      order: { createdAt: 'DESC' },
      relations: ['payrollRun'],
    });
  }
  async paginate(
    options: FindManyOptions<PayrollItem>,
  ): Promise<{ data: PayrollItem[]; total: number }> {
    const [data, total] = await this.payrollItemRepository.findAndCount(options);
    return { data, total };
  }
}
