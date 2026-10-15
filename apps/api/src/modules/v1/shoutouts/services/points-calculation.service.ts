import { BadRequestException, Injectable } from '@nestjs/common';
import { ShoutoutPointTransactionType } from 'src/common/enums/shoutout-point-transaction-type.enum';
import type { AllowancePeriod } from 'src/common/utils/date-time.helper';
import { DateTimeHelper } from 'src/common/utils/date-time.helper';
import { getPaginationSummary } from 'src/common/utils/pagination.util';
import type { EntityManager } from 'typeorm';
import { TenantConfigService } from '../../tenant-settings/services/tenant-config.service';
import { ShoutoutMemberPoints } from '../entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from '../entities/shoutout-point-transaction.entity';
import { MemberPointsRepository } from '../repositories/member-points.repository';

@Injectable()
export class PointsCalculationService {
  constructor(
    private readonly memberPointsRepository: MemberPointsRepository,
    private readonly tenantConfigService: TenantConfigService,
  ) {}

  async ensureMemberRow(
    tenantId: string,
    memberId: string,
    manager?: EntityManager,
  ): Promise<ShoutoutMemberPoints> {
    const repo = manager
      ? manager.getRepository(ShoutoutMemberPoints)
      : this.memberPointsRepository;
    const row = await repo.findOne({ where: { tenantId, memberId } });
    if (row) return row;

    const startingBalance =
      (await this.tenantConfigService.getPointsStartingBalance(tenantId)) ?? 0;

    try {
      await repo
        .createQueryBuilder()
        .insert()
        .into(ShoutoutMemberPoints)
        .values({
          tenantId,
          memberId,
          currentBalance: startingBalance,
          lastResetDate: new Date(),
        })
        .orIgnore()
        .execute();
    } catch (_error) {
      // Ignore database-level unique constraint exceptions on insert
    }
    return repo.findOneOrFail({ where: { tenantId, memberId } });
  }

  async ensureMonthlyReset(
    row: ShoutoutMemberPoints,
    manager?: EntityManager,
    allowancePeriod: AllowancePeriod = 'monthly',
  ): Promise<ShoutoutMemberPoints> {
    const now = new Date();
    if (DateTimeHelper.isCurrentPeriod(row.lastResetDate, allowancePeriod)) return row;

    const repo = manager
      ? manager.getRepository(ShoutoutMemberPoints)
      : this.memberPointsRepository;

    row.monthlyGiven = 0;
    row.monthlyReceived = 0;
    row.lastResetDate = DateTimeHelper.getPeriodStart(allowancePeriod, now);
    const saved = await repo.save(row);

    await this.memberPointsRepository.insertTransaction(
      manager ?? this.memberPointsRepository.manager,
      {
        tenantId: row.tenantId,
        memberId: row.memberId,
        type: ShoutoutPointTransactionType.MONTHLY_RESET,
        points: 0,
        runningBalance: row.currentBalance,
        description: `${allowancePeriod} points reset`,
        createdBy: row.memberId,
      },
    );

    return saved;
  }

  async getAllowancePeriod(tenantId: string): Promise<AllowancePeriod> {
    const pointsSettings = await this.tenantConfigService.getPointsSettings(tenantId);
    return pointsSettings?.allowancePeriod ?? 'monthly';
  }

  async getBalance(tenantId: string, memberId: string) {
    const allowancePeriod = await this.getAllowancePeriod(tenantId);
    let row = await this.ensureMemberRow(tenantId, memberId);
    row = await this.ensureMonthlyReset(row, undefined, allowancePeriod);

    const pointsSettings = await this.tenantConfigService.getPointsSettings(tenantId);
    const monthlyAllowance = pointsSettings?.monthlyAllowance ?? 0;

    return {
      memberId,
      currentBalance: row.currentBalance,
      totalEarned: row.totalEarned,
      totalGiven: row.totalGiven,
      monthlyGiven: row.monthlyGiven,
      monthlyReceived: row.monthlyReceived,
      monthlyAllowance,
      allowancePeriod,
      remainingAllowance: Math.max(0, monthlyAllowance - row.monthlyGiven),
      lastResetDate: row.lastResetDate,
    };
  }

  async listTransactions(tenantId: string, memberId: string, page: number, limit: number) {
    const { records, total } = await this.memberPointsRepository.listTransactions(
      tenantId,
      memberId,
      page,
      limit,
    );
    return getPaginationSummary(records, total, { page, limit }, 'transactions');
  }

  async listMembersWithPoints(tenantId: string) {
    const rows = await this.memberPointsRepository.listByTenant(tenantId);
    return rows.map((row) => ({
      memberId: row.memberId,
      firstName: row.member?.firstName ?? null,
      lastName: row.member?.lastName ?? null,
      currentBalance: row.currentBalance,
      totalEarned: row.totalEarned,
      totalGiven: row.totalGiven,
      monthlyGiven: row.monthlyGiven,
      monthlyReceived: row.monthlyReceived,
    }));
  }

  async validateSenderAllowance(
    tenantId: string,
    senderMemberId: string,
    totalCost: number,
    manager: EntityManager,
  ): Promise<ShoutoutMemberPoints> {
    const allowancePeriod = await this.getAllowancePeriod(tenantId);
    let sender = await this.ensureMemberRow(tenantId, senderMemberId, manager);
    sender = await this.ensureMonthlyReset(sender, manager, allowancePeriod);

    const pointsSettings = await this.tenantConfigService.getPointsSettings(tenantId);
    const monthlyAllowance = pointsSettings?.monthlyAllowance ?? 0;
    const allowanceRemaining = monthlyAllowance - sender.monthlyGiven;

    if (totalCost > allowanceRemaining) {
      throw new BadRequestException(
        `Insufficient allowance. You have ${allowanceRemaining} Paq points remaining this ${allowancePeriod} period.`,
      );
    }

    const now = new Date();
    const dailyGiven = await this.memberPointsRepository.sumPointsGivenSince(
      manager,
      tenantId,
      senderMemberId,
      DateTimeHelper.getStartOfUtcDay(now),
    );
    const monthlyGiven = await this.memberPointsRepository.sumPointsGivenSince(
      manager,
      tenantId,
      senderMemberId,
      DateTimeHelper.getStartOfUtcMonth(now),
    );

    const limitCheck = await this.tenantConfigService.validatePointsOperation(
      tenantId,
      dailyGiven,
      monthlyGiven,
      totalCost,
    );

    if (!limitCheck.isValid) {
      throw new BadRequestException(limitCheck.reason ?? 'Points limit exceeded');
    }

    return sender;
  }

  async hasCelebrationGrant(
    tenantId: string,
    memberId: string,
    dedupKey: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const repo = manager
      ? manager.getRepository(ShoutoutPointTransaction)
      : this.memberPointsRepository.manager.getRepository(ShoutoutPointTransaction);
    const existing = await repo.findOne({
      where: { tenantId, memberId, description: dedupKey },
    });
    return Boolean(existing);
  }
}
