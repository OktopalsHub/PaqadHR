import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveBalance } from './entities/leave-balance.entity';

@Injectable()
export class LeaveBalanceRepository extends Repository<LeaveBalance> {
  constructor(
    @InjectRepository(LeaveBalance)
    private readonly leaveBalanceRepository: Repository<LeaveBalance>,
  ) {
    super(
      leaveBalanceRepository.target,
      leaveBalanceRepository.manager,
      leaveBalanceRepository.queryRunner,
    );
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
  async findByMember(tenantId: string, memberId: string, year: number): Promise<LeaveBalance[]> {
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

  async findAdminListWithLabels(
    tenantId: string,
    memberIds?: string[],
  ): Promise<
    Array<{
      id: string;
      memberId: string;
      leaveTypeId: string;
      totalDays: number;
      usedDays: number;
      remainingDays: number;
      carryoverDays: number;
      regularDays: number;
      carryoverUsed: number;
      year: number;
      tenantId: string;
      createdAt: Date;
      updatedAt: Date;
      leaveTypeName: string | null;
      memberPreferredName: string | null;
      memberFirstName: string | null;
      memberLastName: string | null;
    }>
  > {
    const qb = this.leaveBalanceRepository
      .createQueryBuilder('balance')
      .leftJoin('balance.leaveType', 'leaveType')
      .leftJoin('balance.tenantMember', 'member')
      .select([
        'balance.id AS id',
        'balance.member_id AS "memberId"',
        'balance.leave_type_id AS "leaveTypeId"',
        'balance.total_days AS "totalDays"',
        'balance.used_days AS "usedDays"',
        'balance.remaining_days AS "remainingDays"',
        'balance.carryover_days AS "carryoverDays"',
        'balance.regular_days AS "regularDays"',
        'balance.carryover_used AS "carryoverUsed"',
        'balance.year AS year',
        'balance.tenant_id AS "tenantId"',
        'balance.created_at AS "createdAt"',
        'balance.updated_at AS "updatedAt"',
        'leaveType.name AS "leaveTypeName"',
        'member.preferred_name AS "memberPreferredName"',
        'member.first_name AS "memberFirstName"',
        'member.last_name AS "memberLastName"',
      ])
      .where('balance.tenant_id = :tenantId', { tenantId })
      .orderBy('balance.year', 'DESC')
      .addOrderBy('member.last_name', 'ASC')
      .addOrderBy('member.first_name', 'ASC');

    if (memberIds?.length) {
      qb.andWhere('balance.member_id IN (:...memberIds)', { memberIds });
    }

    return qb.getRawMany();
  }
}
