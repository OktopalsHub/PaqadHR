import { Injectable } from '@nestjs/common';
import { ShoutoutPointTransactionType } from 'src/common/enums/shoutout-point-transaction-type.enum';
import { DateTimeHelper } from 'src/common/utils/date-time.helper';
import type { EntityManager } from 'typeorm';
import { In } from 'typeorm';
import { TenantConfigService } from '../../tenant-settings/services/tenant-config.service';
import { ShoutoutMemberPoints } from '../entities/shoutout-member-points.entity';
import { MemberPointsRepository } from '../repositories/member-points.repository';
import { PointsCalculationService } from './points-calculation.service';

@Injectable()
export class PointsShoutoutService {
  constructor(
    private readonly memberPointsRepository: MemberPointsRepository,
    private readonly tenantConfigService: TenantConfigService,
    private readonly pointsCalculationService: PointsCalculationService,
  ) {}

  async grantCelebrationPoints(
    manager: EntityManager,
    tenantId: string,
    recipientId: string,
    points: number,
    shoutoutId: string,
    dedupKey: string,
    actorId: string,
  ): Promise<void> {
    const allowancePeriod = await this.pointsCalculationService.getAllowancePeriod(tenantId);
    let recipient = await this.pointsCalculationService.ensureMemberRow(
      tenantId,
      recipientId,
      manager,
    );
    recipient = await this.pointsCalculationService.ensureMonthlyReset(
      recipient,
      manager,
      allowancePeriod,
    );
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
    recipients: { recipientId: string; points: number }[],
    shoutoutId: string,
  ): Promise<void> {
    const allowancePeriod = await this.pointsCalculationService.getAllowancePeriod(tenantId);
    const totalCost = recipients.reduce((sum, r) => sum + r.points, 0);
    const sender = await this.pointsCalculationService.validateSenderAllowance(
      tenantId,
      senderMemberId,
      totalCost,
      manager,
    );

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
      description: `Gave shoutout to ${recipients.length} recipient(s)`,
      createdBy: senderMemberId,
    });

    const uniqueRecipientIds = [...new Set(recipients.map((r) => r.recipientId))];
    const repo = manager.getRepository(ShoutoutMemberPoints);
    let existingRows = await repo.find({ where: { tenantId, memberId: In(uniqueRecipientIds) } });

    const missingIds = uniqueRecipientIds.filter(
      (id) => !existingRows.some((row) => row.memberId === id),
    );
    if (missingIds.length > 0) {
      const startingBalance =
        (await this.tenantConfigService.getPointsStartingBalance(tenantId)) ?? 0;
      await repo
        .createQueryBuilder()
        .insert()
        .into(ShoutoutMemberPoints)
        .values(
          missingIds.map((memberId) => ({
            tenantId,
            memberId,
            currentBalance: startingBalance,
            lastResetDate: new Date(),
          })),
        )
        .orIgnore()
        .execute();
      const freshRows = await repo.find({ where: { tenantId, memberId: In(missingIds) } });
      existingRows = [...existingRows, ...freshRows];
    }

    const pointsByRecipient = new Map<string, number>();
    for (const { recipientId, points: pts } of recipients) {
      pointsByRecipient.set(recipientId, (pointsByRecipient.get(recipientId) ?? 0) + pts);
    }

    const now = new Date();
    for (const row of existingRows) {
      if (!DateTimeHelper.isCurrentPeriod(row.lastResetDate, allowancePeriod)) {
        row.monthlyGiven = 0;
        row.monthlyReceived = 0;
        row.lastResetDate = DateTimeHelper.getPeriodStart(allowancePeriod, now);
        await repo.save(row);
        await this.memberPointsRepository.insertTransaction(manager, {
          tenantId,
          memberId: row.memberId,
          type: ShoutoutPointTransactionType.MONTHLY_RESET,
          points: 0,
          runningBalance: row.currentBalance,
          description: `${allowancePeriod} points reset`,
          createdBy: row.memberId,
        });
      }
      const pts = pointsByRecipient.get(row.memberId) ?? 0;
      if (pts > 0) {
        row.monthlyReceived += pts;
        row.currentBalance += pts;
        row.totalEarned += pts;
        await repo.save(row);
        await this.memberPointsRepository.insertTransaction(manager, {
          tenantId,
          memberId: row.memberId,
          type: ShoutoutPointTransactionType.RECEIVED,
          points: pts,
          runningBalance: row.currentBalance,
          shoutoutId,
          description: 'Received shoutout',
          createdBy: senderMemberId,
        });
      }
    }
  }
}
