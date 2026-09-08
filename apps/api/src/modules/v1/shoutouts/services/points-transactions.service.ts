import { Injectable, Logger } from '@nestjs/common';
import { ShoutoutPointTransactionType } from 'src/common/enums/shoutout-point-transaction-type.enum';
import { DataSource } from 'typeorm';
import { ActivitiesService } from '../../activities/services/activities.service';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import { TenantConfigService } from '../../tenant-settings/services/tenant-config.service';
import { ShoutoutMemberPoints } from '../entities/shoutout-member-points.entity';
import { MemberPointsRepository } from '../repositories/member-points.repository';
import { PointsCalculationService } from './points-calculation.service';

@Injectable()
export class PointsTransactionsService {
  private readonly logger = new Logger(PointsTransactionsService.name);
  constructor(
    private readonly memberPointsRepository: MemberPointsRepository,
    private readonly tenantConfigService: TenantConfigService,
    private readonly tenantMembersService: TenantMembersService,
    private readonly dataSource: DataSource,
    private readonly activitiesService: ActivitiesService,
    private readonly notificationHelper: NotificationHelperService,
    private readonly pointsCalculationService: PointsCalculationService,
  ) {}

  private logPointsAssignment(payload: {
    tenantId: string;
    actorId: string;
    membersUpdated: number;
    pointsAssigned: number;
    reason?: string;
    scope: 'all' | 'selected';
  }): void {
    void this.activitiesService
      .queueActivity({
        tenantId: payload.tenantId,
        actorMemberId: payload.actorId,
        action: 'points.assigned',
        resourceType: 'points',
        description:
          payload.scope === 'all'
            ? `Everyone got ${payload.pointsAssigned} points`
            : `Assigned ${payload.pointsAssigned} points to ${payload.membersUpdated} member(s)`,
        metadata: {
          membersUpdated: payload.membersUpdated,
          pointsAssigned: payload.pointsAssigned,
          reason: payload.reason ?? null,
          scope: payload.scope,
        },
      })
      .catch(() => {});
  }

  private sendBulkAssignNotifications(
    tenantId: string,
    entries: { memberId: string; points: number }[],
    actorId: string,
    reason?: string,
  ): void {
    void (async () => {
      let actorName = 'Admin';
      try {
        const actor = await this.tenantMembersService.getTenantMemberId(tenantId, actorId);
        actorName = actor.displayName;
      } catch {
        // fall back to 'Admin'
      }
      const results = await Promise.allSettled(
        entries.map(({ memberId, points }) =>
          this.notificationHelper.sendPointsAwardedNotification(memberId, tenantId, {
            points,
            awardedBy: actorName,
            reason,
          }),
        ),
      );
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        this.logger.error(
          `Failed to send ${failures.length}/${entries.length} points awarded notifications`,
          failures.map((f) => (f as PromiseRejectedResult).reason),
        );
      }
    })();
  }

  async bulkAssign(tenantId: string, points: number, reason: string | undefined, actorId: string) {
    const allowancePeriod = await this.pointsCalculationService.getAllowancePeriod(tenantId);
    const members = await this.tenantMembersService.getTenantMembers(tenantId);
    let membersUpdated = 0;

    await this.dataSource.transaction(async (manager) => {
      for (const member of members) {
        let row = await this.pointsCalculationService.ensureMemberRow(tenantId, member.id, manager);
        row = await this.pointsCalculationService.ensureMonthlyReset(row, manager, allowancePeriod);
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

    this.logPointsAssignment({
      tenantId,
      actorId,
      membersUpdated,
      pointsAssigned: points,
      reason,
      scope: 'all',
    });
    this.sendBulkAssignNotifications(
      tenantId,
      members.map((m) => ({ memberId: m.id, points })),
      actorId,
      reason,
    );
    return {
      success: true,
      message: `Assigned ${points} Paq points to ${membersUpdated} members`,
      membersUpdated,
      pointsAssigned: points,
    };
  }

  async assignPoints(
    tenantId: string,
    memberIds: string[],
    points: number,
    reason: string | undefined,
    actorId: string,
    assignments?: { memberId: string; points: number }[],
  ) {
    const allowancePeriod = await this.pointsCalculationService.getAllowancePeriod(tenantId);
    let membersUpdated = 0;
    let totalPointsAssigned = 0;

    await this.dataSource.transaction(async (manager) => {
      const list =
        assignments && assignments.length > 0
          ? assignments
          : memberIds.map((id) => ({ memberId: id, points }));
      for (const { memberId, points: pts } of list) {
        await this.tenantMembersService.getTenantMemberId(tenantId, memberId);
        let row = await this.pointsCalculationService.ensureMemberRow(tenantId, memberId, manager);
        row = await this.pointsCalculationService.ensureMonthlyReset(row, manager, allowancePeriod);
        row.currentBalance += pts;
        row.totalEarned += pts;
        await manager.save(row);
        await this.memberPointsRepository.insertTransaction(manager, {
          tenantId,
          memberId,
          type: ShoutoutPointTransactionType.ADMIN_ASSIGN,
          points: pts,
          runningBalance: row.currentBalance,
          description: reason ?? 'Direct points assignment by admin',
          createdBy: actorId,
        });
        membersUpdated++;
        totalPointsAssigned += pts;
      }
    });

    this.logPointsAssignment({
      tenantId,
      actorId,
      membersUpdated,
      pointsAssigned: totalPointsAssigned,
      reason,
      scope: 'selected',
    });
    const entries =
      assignments && assignments.length > 0
        ? assignments.map((a) => ({ memberId: a.memberId, points: a.points }))
        : memberIds.map((id) => ({ memberId: id, points }));
    this.sendBulkAssignNotifications(tenantId, entries, actorId, reason);
    return {
      success: true,
      message: `Assigned points to ${membersUpdated} member(s)`,
      membersUpdated,
      pointsAssigned: totalPointsAssigned,
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
        const existing = await repo.findOne({ where: { tenantId, memberId: member.id } });
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
}
