import { BadRequestException, Injectable } from '@nestjs/common';
import { ShoutoutPointTransactionType } from 'src/common/enums/shoutout-point-transaction-type.enum';
import { type AllowancePeriod, DateTimeHelper } from 'src/common/utils/date-time.helper';
import { getPaginationSummary } from 'src/common/utils/pagination.util';
import { DataSource, EntityManager } from 'typeorm';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import { TenantConfigService } from '../../tenant-settings/services/tenant-config.service';
import { ShoutoutMemberPoints } from '../entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from '../entities/shoutout-point-transaction.entity';
import { MemberPointsRepository } from '../repositories/member-points.repository';

@Injectable()
export class MemberPointsService {
  constructor(
    private readonly memberPointsRepository: MemberPointsRepository,
    private readonly tenantConfigService: TenantConfigService,
    private readonly tenantMembersService: TenantMembersService,
    private readonly dataSource: DataSource,
  ) {}

  async ensureMemberRow(
    tenantId: string,
    memberId: string,
    manager?: EntityManager,
  ): Promise<ShoutoutMemberPoints> {
    const repo = manager
      ? manager.getRepository(ShoutoutMemberPoints)
      : this.memberPointsRepository;
    let row = await repo.findOne({ where: { tenantId, memberId } });
    if (row) return row;

    const startingBalance =
      (await this.tenantConfigService.getPointsStartingBalance(tenantId)) ?? 0;

    row = repo.create({
      tenantId,
      memberId,
      currentBalance: startingBalance,
      lastResetDate: new Date(),
    });
    try {
      return await repo.save(row);
    } catch (error) {
      const isDuplicate =
        error instanceof Error && 'code' in error && (error as { code?: string }).code === '23505';
      if (isDuplicate) {
        const existing = await repo.findOne({ where: { tenantId, memberId } });
        if (existing) return existing;
      }
      throw error;
    }
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

    await this.memberPointsRepository.insertTransaction(manager ?? this.dataSource.manager, {
      tenantId: row.tenantId,
      memberId: row.memberId,
      type: ShoutoutPointTransactionType.MONTHLY_RESET,
      points: 0,
      runningBalance: row.currentBalance,
      description: `${allowancePeriod} points reset`,
      createdBy: row.memberId,
    });

    return saved;
  }

  private async getAllowancePeriod(tenantId: string): Promise<AllowancePeriod> {
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

  async bulkAssign(tenantId: string, points: number, reason: string | undefined, actorId: string) {
    const allowancePeriod = await this.getAllowancePeriod(tenantId);
    const members = await this.tenantMembersService.getTenantMembers(tenantId);
    let membersUpdated = 0;

    await this.dataSource.transaction(async (manager) => {
      for (const member of members) {
        let row = await this.ensureMemberRow(tenantId, member.id, manager);
        row = await this.ensureMonthlyReset(row, manager, allowancePeriod);
        row.currentBalance += points;
        row.totalEarned += points;
        await manager.save(row);

        await this.memberPointsRepository.insertTransaction(manager, {
          tenantId,
          memberId: member.id,
          type: ShoutoutPointTransactionType.ADMIN_ASSIGN,
          points,
          runningBalance: row.currentBalance,
          description: reason ?? 'Admin points assignment',
          createdBy: actorId,
        });
        membersUpdated++;
      }
    });

    return {
      success: true,
      message: `Assigned ${points} Paq points to ${membersUpdated} members`,
      membersUpdated,
      pointsAssigned: points,
    };
  }

  async initializeAllMembers(tenantId: string, initialPoints?: number) {
    const pointsSettings = await this.tenantConfigService.getPointsSettings(tenantId);
    const members = await this.tenantMembersService.getTenantMembers(tenantId);
    const startingBalance = initialPoints ?? pointsSettings?.startingBalance ?? 0;
    const autoAssign = pointsSettings?.autoAssignPoints ?? false;
    const autoAmount = pointsSettings?.autoAssignAmount ?? 0;

    let initialized = 0;
    await this.dataSource.transaction(async (manager) => {
      for (const member of members) {
        const repo = manager.getRepository(ShoutoutMemberPoints);
        const existing = await repo.findOne({
          where: { tenantId, memberId: member.id },
        });
        if (existing) continue;

        let balance = startingBalance;
        const row = repo.create({
          tenantId,
          memberId: member.id,
          currentBalance: balance,
          lastResetDate: new Date(),
        });
        await repo.save(row);
        initialized++;

        if (autoAssign && autoAmount > 0) {
          balance += autoAmount;
          row.currentBalance = balance;
          row.totalEarned = autoAmount;
          await repo.save(row);
          await this.memberPointsRepository.insertTransaction(manager, {
            tenantId,
            memberId: member.id,
            type: ShoutoutPointTransactionType.ADMIN_ASSIGN,
            points: autoAmount,
            runningBalance: balance,
            description: 'Auto-assigned starting points',
            createdBy: member.id,
          });
        }
      }
    });

    return { initialized };
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

  async grantCelebrationPoints(
    manager: EntityManager,
    tenantId: string,
    recipientId: string,
    points: number,
    shoutoutId: string,
    dedupKey: string,
    actorId: string,
  ): Promise<void> {
    const allowancePeriod = await this.getAllowancePeriod(tenantId);
    let recipient = await this.ensureMemberRow(tenantId, recipientId, manager);
    recipient = await this.ensureMonthlyReset(recipient, manager, allowancePeriod);
    recipient.monthlyReceived += points;
    recipient.currentBalance += points;
    recipient.totalEarned += points;
    await manager.save(recipient);

    await this.memberPointsRepository.insertTransaction(manager, {
      tenantId,
      memberId: recipientId,
      type: ShoutoutPointTransactionType.ADMIN_ASSIGN,
      points,
      runningBalance: recipient.currentBalance,
      shoutoutId,
      description: dedupKey,
      createdBy: actorId,
    });
  }

  async applyShoutoutPoints(
    manager: EntityManager,
    tenantId: string,
    senderMemberId: string,
    recipientIds: string[],
    pointsEach: number,
    shoutoutId: string,
  ): Promise<void> {
    const allowancePeriod = await this.getAllowancePeriod(tenantId);
    const totalCost = pointsEach * recipientIds.length;
    const sender = await this.validateSenderAllowance(tenantId, senderMemberId, totalCost, manager);

    sender.monthlyGiven += totalCost;
    sender.totalGiven += totalCost;
    await manager.save(sender);

    await this.memberPointsRepository.insertTransaction(manager, {
      tenantId,
      memberId: senderMemberId,
      type: ShoutoutPointTransactionType.GIVEN,
      points: -totalCost,
      runningBalance: sender.currentBalance,
      shoutoutId,
      description: `Gave shoutout to ${recipientIds.length} recipient(s)`,
      createdBy: senderMemberId,
    });

    for (const recipientId of recipientIds) {
      let recipient = await this.ensureMemberRow(tenantId, recipientId, manager);
      recipient = await this.ensureMonthlyReset(recipient, manager, allowancePeriod);
      recipient.monthlyReceived += pointsEach;
      recipient.currentBalance += pointsEach;
      recipient.totalEarned += pointsEach;
      await manager.save(recipient);

      await this.memberPointsRepository.insertTransaction(manager, {
        tenantId,
        memberId: recipientId,
        type: ShoutoutPointTransactionType.RECEIVED,
        points: pointsEach,
        runningBalance: recipient.currentBalance,
        shoutoutId,
        description: 'Received shoutout',
        createdBy: senderMemberId,
      });
    }
  }
}
