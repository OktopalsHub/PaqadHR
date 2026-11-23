import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ShoutoutPointTransactionType } from 'src/common/enums/shoutout-point-transaction-type.enum';
import type { EntityManager } from 'typeorm';
import { DataSource, Not } from 'typeorm';

import { Employment } from '../../employment/entities/employment.entity';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { ShoutoutMemberPoints } from '../../shoutouts/entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from '../../shoutouts/entities/shoutout-point-transaction.entity';
import { Shoutout } from '../../shoutouts/entities/shoutout.entity';
import { addMemberPoints } from '../../shoutouts/utils/member-points-delta.util';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TaskSubmission } from '../entities/task-submission.entity';
import { Task } from '../entities/task.entity';

@Injectable()
export class RewardsTaskCompletionService {
  private readonly logger = new Logger(RewardsTaskCompletionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notificationHelper: NotificationHelperService,
  ) {}

  async submitTask(
    tenantId: string,
    taskId: string,
    memberId: string,
    data: { submissionText?: string; submissionFileName?: string },
  ) {
    const task = await this.dataSource.getRepository(Task).findOne({ where: { id: taskId, tenantId } });
    if (!task) throw new BadRequestException('Task not found');
    const isInstant = task.submissionType === 'instant';
    const status: 'pending' | 'completed' | 'rejected' = isInstant ? 'completed' : 'pending';
    await this.dataSource.transaction(async (manager) => {
      await this.lockTaskMember(manager, taskId, memberId);
      const submissionRepo = manager.getRepository(TaskSubmission);
      let sub = await submissionRepo.findOne({ where: { taskId, memberId, tenantId } });
      if (sub?.status === 'completed') throw new BadRequestException('Task already completed');
      if (!sub)
        sub = submissionRepo.create({
          tenantId,
          taskId,
          memberId,
          status,
          submissionText: data.submissionText ?? undefined,
          submissionFileName: data.submissionFileName ?? undefined,
        });
      else {
        sub.status = status;
        sub.submissionText = data.submissionText ?? sub.submissionText;
        sub.submissionFileName = data.submissionFileName ?? sub.submissionFileName;
      }
      await submissionRepo.save(sub);
      if (isInstant) await this.creditTaskPoints(manager, tenantId, memberId, task.points, task.title);
    });
    if (isInstant) this.notifyTaskPoints(tenantId, memberId, task.points, task.title);
    return { success: true, status, pointsAwarded: isInstant ? task.points : 0 };
  }

  async approveSubmission(tenantId: string, taskId: string, submissionId: string, actorId: string) {
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);
    const sub = await submissionRepo.findOne({ where: { id: submissionId, tenantId, taskId } });
    if (!sub) throw new BadRequestException('Submission not found');
    if (sub.status === 'completed') throw new BadRequestException('Submission already approved');
    if (actorId === sub.memberId)
      throw new BadRequestException('You cannot approve your own task submission');
    if (!(await this.canActorApproveFor(tenantId, actorId, sub.memberId)))
      throw new BadRequestException('You do not have permission to approve this submission.');
    const task = await this.dataSource
      .getRepository(Task)
      .findOne({ where: { id: taskId, tenantId } });
    if (!task) throw new BadRequestException('Task not found');
    await this.dataSource.transaction(async (manager) => {
      await this.lockTaskMember(manager, taskId, sub.memberId);
      const claimed = await manager
        .getRepository(TaskSubmission)
        .update({ id: submissionId, tenantId, taskId, status: Not('completed') }, { status: 'completed' });
      if (!claimed.affected) throw new BadRequestException('Submission already approved');
      await this.creditTaskPoints(manager, tenantId, sub.memberId, task.points, task.title);
    });
    this.notifyTaskPoints(tenantId, sub.memberId, task.points, task.title);
    return { success: true };
  }

  async rejectSubmission(tenantId: string, taskId: string, submissionId: string, actorId: string) {
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);
    const sub = await submissionRepo.findOne({ where: { id: submissionId, tenantId, taskId } });
    if (!sub) throw new BadRequestException('Submission not found');
    if (actorId === sub.memberId)
      throw new BadRequestException('You cannot reject your own task submission');
    if (!(await this.canActorApproveFor(tenantId, actorId, sub.memberId)))
      throw new BadRequestException('You do not have permission to reject this submission.');
    sub.status = 'rejected';
    await submissionRepo.save(sub);
    return { success: true };
  }

  private async canActorApproveFor(
    tenantId: string,
    actorId: string,
    submitterMemberId: string,
  ): Promise<boolean> {
    if (actorId === submitterMemberId) return false;
    const actor = await this.dataSource
      .getRepository(TenantMember)
      .findOne({ where: { id: actorId, tenantId } });
    if (!actor) return false;
    const role = actor.role?.toLowerCase();
    if (role === 'admin' || role === 'owner') return true;
    const submitterEmployment = await this.dataSource.getRepository(Employment).findOne({
      where: { tenantMemberId: submitterMemberId, tenantId },
      order: { startDate: 'DESC' },
    });
    return submitterEmployment?.reportsToId === actorId;
  }

  /** One task completion per member and task at a time, until the schema has a unique key. */
  private async lockTaskMember(manager: EntityManager, taskId: string, memberId: string) {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `task-completion:${taskId}:${memberId}`,
    ]);
  }

  private async creditTaskPoints(
    manager: EntityManager,
    tenantId: string,
    memberId: string,
    points: number,
    taskTitle: string,
  ) {
    const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
    if (!(await pointsRepo.exists({ where: { tenantId, memberId } })))
      await pointsRepo
        .createQueryBuilder()
        .insert()
        .into(ShoutoutMemberPoints)
        .values({ tenantId, memberId, currentBalance: 0, totalEarned: 0, lastResetDate: new Date() })
        .orIgnore()
        .execute();
    const newBalance = await addMemberPoints(manager, tenantId, memberId, {
      balance: points,
      earned: points,
    });
    await manager.getRepository(ShoutoutPointTransaction).save(
      manager.getRepository(ShoutoutPointTransaction).create({
        tenantId,
        memberId,
        type: ShoutoutPointTransactionType.ADMIN_ASSIGN,
        points,
        runningBalance: newBalance,
        description: `Completed task: ${taskTitle}`,
        createdBy: memberId,
      }),
    );
    await manager.getRepository(Shoutout).save(
      manager.getRepository(Shoutout).create({
        tenantId,
        totalPoints: points,
        createdBy: memberId,
        message: `completed task: ${taskTitle}`,
      }),
    );
  }

  private notifyTaskPoints(tenantId: string, memberId: string, points: number, taskTitle: string) {
    this.notificationHelper
      .sendTaskCompletionPointsNotification(memberId, tenantId, { points, taskTitle })
      .catch((error) => this.logger.error('Failed to send task completion notification', error));
  }
}
