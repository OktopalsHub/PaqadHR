import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveBalance } from "./entities/leave-balance.entity";

@Injectable()
export class LeaveBalanceRepository extends Repository<LeaveBalance> {
  constructor(
    @InjectRepository(LeaveBalance)
    private readonly leaveBalanceRepository: Repository<LeaveBalance>,
  ) {
    super(leaveBalanceRepository.target, leaveBalanceRepository.manager, leaveBalanceRepository.queryRunner);
  }
  async findByCriteria(criteria: {
    tenantId: string;
    memberId: string;
    leaveTypeId: string;
    year: number;
  }): Promise<LeaveBalance | null> {
    const { tenantId, memberId, leaveTypeId, year } = criteria;
    return this.leaveBalanceRepository.findOne({
      where: {
        tenantId,
        memberId,
        leaveTypeId,
        year,
      },
    });
  }
  async findByMember(
    tenantId: string,
    memberId: string,
    year: number,
  ): Promise<LeaveBalance[]> {
    return this.leaveBalanceRepository.find({
      where: {
        tenantId,
        memberId,
        year,
      },
      relations: ['leaveType'],
    });
  }
  async getBalanceStatsByTenant(tenantId: string, year: number) {
    return this.leaveBalanceRepository
      .createQueryBuilder('balance')
      .select('balance.tenantId', 'tenantId')
      .addSelect('balance.year', 'year')
      .addSelect('SUM(balance.totalDays)', 'totalAllocatedDays')
      .addSelect('SUM(balance.usedDays)', 'totalUsedDays')
      .addSelect('SUM(balance.remainingDays)', 'totalRemainingDays')
      .where('balance.tenantId = :tenantId', { tenantId })
      .andWhere('balance.year = :year', { year })
      .groupBy('balance.tenantId')
      .addGroupBy('balance.year')
      .getRawOne();
  }
  async getBalanceStatsByTenantAndLeaveType(tenantId: string, year: number) {
    return this.leaveBalanceRepository
      .createQueryBuilder('balance')
      .leftJoin('balance.leaveType', 'leaveType')
      .select('balance.tenantId', 'tenantId')
      .addSelect('balance.year', 'year')
      .addSelect('balance.leaveTypeId', 'leaveTypeId')
      .addSelect('leaveType.name', 'leaveTypeName')
      .addSelect('SUM(balance.totalDays)', 'totalAllocatedDays')
      .addSelect('SUM(balance.usedDays)', 'totalUsedDays')
      .addSelect('SUM(balance.remainingDays)', 'totalRemainingDays')
      .where('balance.tenantId = :tenantId', { tenantId })
      .andWhere('balance.year = :year', { year })
      .groupBy('balance.tenantId')
      .addGroupBy('balance.year')
      .addGroupBy('balance.leaveTypeId')
      .addGroupBy('leaveType.name')
      .getRawMany();
  }
}
