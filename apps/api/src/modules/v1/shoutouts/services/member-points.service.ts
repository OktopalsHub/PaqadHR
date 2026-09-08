import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { ShoutoutMemberPoints } from '../entities/shoutout-member-points.entity';
import { PointsCalculationService } from './points-calculation.service';
import { PointsShoutoutService } from './points-shoutout.service';
import { PointsTransactionsService } from './points-transactions.service';

@Injectable()
export class MemberPointsService {
  constructor(
    private readonly pointsCalculationService: PointsCalculationService,
    private readonly pointsTransactionsService: PointsTransactionsService,
    private readonly pointsShoutoutService: PointsShoutoutService,
  ) {}

  ensureMemberRow(tenantId: string, memberId: string, manager?: EntityManager) {
    return this.pointsCalculationService.ensureMemberRow(tenantId, memberId, manager);
  }

  ensureMonthlyReset(
    row: ShoutoutMemberPoints,
    manager?: EntityManager,
    allowancePeriod?: 'monthly' | 'quarterly' | 'yearly',
  ) {
    return this.pointsCalculationService.ensureMonthlyReset(row, manager, allowancePeriod);
  }

  getBalance(tenantId: string, memberId: string) {
    return this.pointsCalculationService.getBalance(tenantId, memberId);
  }

  listTransactions(tenantId: string, memberId: string, page: number, limit: number) {
    return this.pointsCalculationService.listTransactions(tenantId, memberId, page, limit);
  }

  listMembersWithPoints(tenantId: string) {
    return this.pointsCalculationService.listMembersWithPoints(tenantId);
  }

  validateSenderAllowance(
    tenantId: string,
    senderMemberId: string,
    totalCost: number,
    manager: EntityManager,
  ) {
    return this.pointsCalculationService.validateSenderAllowance(
      tenantId,
      senderMemberId,
      totalCost,
      manager,
    );
  }

  hasCelebrationGrant(
    tenantId: string,
    memberId: string,
    dedupKey: string,
    manager?: EntityManager,
  ) {
    return this.pointsCalculationService.hasCelebrationGrant(tenantId, memberId, dedupKey, manager);
  }

  bulkAssign(tenantId: string, points: number, reason: string | undefined, actorId: string) {
    return this.pointsTransactionsService.bulkAssign(tenantId, points, reason, actorId);
  }

  assignPoints(
    tenantId: string,
    memberIds: string[],
    points: number,
    reason: string | undefined,
    actorId: string,
    assignments?: { memberId: string; points: number }[],
  ) {
    return this.pointsTransactionsService.assignPoints(
      tenantId,
      memberIds,
      points,
      reason,
      actorId,
      assignments,
    );
  }

  initializeAllMembers(tenantId: string, initialPoints?: number) {
    return this.pointsTransactionsService.initializeAllMembers(tenantId, initialPoints);
  }

  grantCelebrationPoints(
    manager: EntityManager,
    tenantId: string,
    recipientId: string,
    points: number,
    shoutoutId: string,
    dedupKey: string,
    actorId: string,
  ) {
    return this.pointsShoutoutService.grantCelebrationPoints(
      manager,
      tenantId,
      recipientId,
      points,
      shoutoutId,
      dedupKey,
      actorId,
    );
  }

  applyShoutoutPoints(
    manager: EntityManager,
    tenantId: string,
    senderMemberId: string,
    recipients: { recipientId: string; points: number }[],
    shoutoutId: string,
  ) {
    return this.pointsShoutoutService.applyShoutoutPoints(
      manager,
      tenantId,
      senderMemberId,
      recipients,
      shoutoutId,
    );
  }
}
