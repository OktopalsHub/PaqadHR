import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ActivitiesService } from '../../activities/services/activities.service';
import { Employment } from '../../employment/entities/employment.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Task } from '../entities/task.entity';
import { TaskSubmission } from '../entities/task-submission.entity';
import { RewardsTaskCompletionService } from './rewards-task-completion.service';
import { RewardsTaskTemplatesService } from './rewards-task-templates.service';

@Injectable()
export class RewardsTaskService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly activitiesService: ActivitiesService,
    private readonly completionService: RewardsTaskCompletionService,
    private readonly templatesService: RewardsTaskTemplatesService,
  ) {}

  async listTasks(tenantId: string, memberId: string) {
    const taskRepo = this.dataSource.getRepository(Task);
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);
    const tasks = await taskRepo.find({ where: { tenantId }, order: { createdAt: 'ASC' } });

    if (tasks.length === 0) {
      await this.templatesService.ensureDefaultTasks(tenantId);
      return this.listTasks(tenantId, memberId);
    }

    const submissions = await submissionRepo.find({ where: { tenantId, memberId } });
    return tasks.map((task) => {
      const taskSubs = submissions
        .filter((s) => s.taskId === task.id)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      const latestSub = taskSubs[0];
      let completed = false;
      let status: 'available' | 'pending' | 'completed' | 'rejected' = 'available';
      if (latestSub) {
        if (latestSub.status === 'completed') {
          if (task.isRecurring) status = 'available';
          else {
            status = 'completed';
            completed = true;
          }
        } else if (latestSub.status === 'pending') status = 'pending';
        else if (latestSub.status === 'rejected') status = 'available';
      }
      return {
        id: task.id,
        title: task.title,
        description: task.description,
        points: task.points,
        icon: task.icon,
        category: task.category,
        imageUrl: task.imageUrl,
        submissionType: task.submissionType,
        isRecurring: task.isRecurring,
        completed,
        status,
        submissionText: latestSub?.submissionText,
        submissionFileName: latestSub?.submissionFileName,
        submissionId: latestSub?.id,
      };
    });
  }

  async listPendingSubmissions(tenantId: string, actorId: string) {
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);
    const taskRepo = this.dataSource.getRepository(Task);
    const memberRepo = this.dataSource.getRepository(TenantMember);
    const actor = await memberRepo.findOne({ where: { id: actorId, tenantId } });
    const isAdminOrOwner = ['admin', 'owner'].includes(actor?.role?.toLowerCase() ?? '');
    const submissions = await submissionRepo.find({
      where: { tenantId, status: 'pending' },
      order: { createdAt: 'DESC' },
    });
    if (submissions.length === 0) return [];
    const tasks = await taskRepo.find({ where: { tenantId } });
    let manageableIds: Set<string> | null = null;
    if (!isAdminOrOwner) {
      const subs = await this.dataSource
        .getRepository(Employment)
        .find({ where: { reportsToId: actorId, tenantId }, select: ['tenantMemberId'] });
      manageableIds = new Set(subs.map((e) => e.tenantMemberId));
    }
    const visible = submissions.filter((s) => {
      if (s.memberId === actorId) return false;
      if (isAdminOrOwner) return true;
      return manageableIds!.has(s.memberId);
    });
    const submitterIds = [...new Set(visible.map((s) => s.memberId))];
    const members = submitterIds.length ? await memberRepo.findByIds(submitterIds) : [];
    const memberMap = new Map(members.map((m) => [m.id, m]));
    return visible.map((sub) => {
      const task = tasks.find((t) => t.id === sub.taskId);
      const member = memberMap.get(sub.memberId);
      return {
        id: task?.id ?? sub.taskId,
        submissionId: sub.id,
        title: task?.title ?? 'Unknown Task',
        description: task?.description ?? '',
        points: task?.points ?? 0,
        icon: task?.icon ?? 'Sparkles',
        category: task?.category,
        imageUrl: task?.imageUrl,
        submissionType: task?.submissionType ?? 'instant',
        status: sub.status,
        submissionText: sub.submissionText,
        submissionFileName: sub.submissionFileName,
        memberId: sub.memberId,
        member: member ? { firstName: member.firstName, lastName: member.lastName } : undefined,
      };
    });
  }

  async createTask(
    tenantId: string,
    data: {
      title: string;
      description: string;
      points: number;
      icon: string;
      category?: string;
      imageUrl?: string;
      submissionType: 'instant' | 'text' | 'file';
      isRecurring?: boolean;
    },
    actorMemberId?: string,
  ) {
    const saved = await this.templatesService.createTask(tenantId, data);
    if (actorMemberId)
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'reward.task_created',
          resourceType: 'task',
          resourceId: saved.id,
          description: `Task "${data.title}" created`,
          metadata: { title: data.title, points: data.points },
        })
        .catch(() => {});
    return saved;
  }

  async updateTask(
    tenantId: string,
    taskId: string,
    data: {
      title?: string;
      description?: string;
      points?: number;
      icon?: string;
      category?: string;
      imageUrl?: string;
      submissionType?: 'instant' | 'text' | 'file';
      isRecurring?: boolean;
    },
    actorMemberId?: string,
  ) {
    const saved = await this.templatesService.updateTask(tenantId, taskId, data);
    if (actorMemberId)
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'reward.task_updated',
          resourceType: 'task',
          resourceId: saved.id,
          description: `Task "${saved.title}" updated`,
          metadata: { title: saved.title, points: saved.points },
        })
        .catch(() => {});
    return saved;
  }

  async deleteTask(tenantId: string, taskId: string, actorMemberId?: string) {
    const result = await this.templatesService.deleteTask(tenantId, taskId);
    if (actorMemberId)
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'reward.task_deleted',
          resourceType: 'task',
          resourceId: taskId,
          description: `Task deleted`,
        })
        .catch(() => {});
    return result;
  }

  async submitTask(
    tenantId: string,
    taskId: string,
    memberId: string,
    data: { submissionText?: string; submissionFileName?: string },
  ) {
    return this.completionService.submitTask(tenantId, taskId, memberId, data);
  }

  async approveSubmission(tenantId: string, taskId: string, submissionId: string, actorId: string) {
    return this.completionService.approveSubmission(tenantId, taskId, submissionId, actorId);
  }

  async rejectSubmission(tenantId: string, taskId: string, submissionId: string, actorId: string) {
    return this.completionService.rejectSubmission(tenantId, taskId, submissionId, actorId);
  }
}
