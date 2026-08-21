import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Task } from '../entities/task.entity';
import { TaskSubmission } from '../entities/task-submission.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Employment } from '../../employment/entities/employment.entity';
import { ActivitiesService } from '../../activities/services/activities.service';
import { RewardsPointsService } from './rewards-points.service';

@Injectable()
export class RewardsTasksService {
  private readonly logger = new Logger(RewardsTasksService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly activitiesService: ActivitiesService,
    private readonly pointsService: RewardsPointsService,
  ) {}

  async listTasks(tenantId: string, memberId: string) {
    const taskRepo = this.dataSource.getRepository(Task);
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);

    const tasks = await taskRepo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });

    if (tasks.length === 0) {
      const defaultTasksData: Array<{
        title: string;
        description: string;
        points: number;
        icon: string;
        category?: string;
        imageUrl?: string;
        submissionType: 'instant' | 'text' | 'file';
        isRecurring: boolean;
      }> = [
        {
          title: 'Welcome Tour',
          description: 'Take a quick 2-minute tour of the workspace and navigation.',
          points: 10,
          icon: 'Compass',
          category: 'Onboarding',
          imageUrl:
            'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=150&auto=format&fit=crop&q=60',
          submissionType: 'instant',
          isRecurring: false,
        },
        {
          title: 'Profile Picture Check',
          description: 'Upload your avatar so your teammates can easily recognize you.',
          points: 25,
          icon: 'User',
          category: 'Profile',
          imageUrl:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=60',
          submissionType: 'file',
          isRecurring: false,
        },
        {
          title: 'Spread Appreciation',
          description: 'Recognize a colleague by writing and sending your first shoutout.',
          points: 15,
          icon: 'Heart',
          category: 'Culture',
          imageUrl:
            'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=60',
          submissionType: 'instant',
          isRecurring: false,
        },
        {
          title: 'Daily 10k Steps Challenge',
          description: 'Take 10,000 steps today and upload a screenshot of your tracker.',
          points: 20,
          icon: 'Activity',
          category: 'Health',
          imageUrl:
            'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=150&auto=format&fit=crop&q=60',
          submissionType: 'file',
          isRecurring: true,
        },
        {
          title: 'Share Feedback',
          description: 'Submit your text feedback on what we can improve in this workspace.',
          points: 15,
          icon: 'MessageSquare',
          category: 'Culture',
          imageUrl:
            'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=150&auto=format&fit=crop&q=60',
          submissionType: 'text',
          isRecurring: true,
        },
      ];

      for (const d of defaultTasksData) {
        const t = taskRepo.create({
          tenantId,
          ...d,
        });
        await taskRepo.save(t);
      }

      return this.listTasks(tenantId, memberId);
    }

    const submissions = await submissionRepo.find({
      where: { tenantId, memberId },
    });

    return tasks.map((task) => {
      const taskSubs = submissions
        .filter((s) => s.taskId === task.id)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      const latestSub = taskSubs[0];

      let completed = false;
      let status: 'available' | 'pending' | 'completed' | 'rejected' = 'available';

      if (latestSub) {
        if (latestSub.status === 'completed') {
          if (task.isRecurring) {
            status = 'available';
          } else {
            status = 'completed';
            completed = true;
          }
        } else if (latestSub.status === 'pending') {
          status = 'pending';
        } else if (latestSub.status === 'rejected') {
          status = 'available';
        }
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

  private async canActorApproveFor(
    tenantId: string,
    actorId: string,
    submitterMemberId: string,
  ): Promise<boolean> {
    if (actorId === submitterMemberId) return false;

    const memberRepo = this.dataSource.getRepository(TenantMember);
    const actor = await memberRepo.findOne({ where: { id: actorId, tenantId } });
    if (!actor) return false;

    const role = actor.role?.toLowerCase();
    if (role === 'admin' || role === 'owner') return true;

    const employmentRepo = this.dataSource.getRepository(Employment);
    const submitterEmployment = await employmentRepo.findOne({
      where: { tenantMemberId: submitterMemberId, tenantId },
      order: { startDate: 'DESC' },
    });

    if (submitterEmployment?.reportsToId === actorId) return true;

    return false;
  }

  async listPendingSubmissions(tenantId: string, actorId: string) {
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);
    const taskRepo = this.dataSource.getRepository(Task);
    const memberRepo = this.dataSource.getRepository(TenantMember);

    const actor = await memberRepo.findOne({ where: { id: actorId, tenantId } });
    const role = actor?.role?.toLowerCase();
    const isAdminOrOwner = role === 'admin' || role === 'owner';

    const submissions = await submissionRepo.find({
      where: { tenantId, status: 'pending' },
      order: { createdAt: 'DESC' },
    });

    if (submissions.length === 0) return [];

    const tasks = await taskRepo.find({ where: { tenantId } });

    const employmentRepo = this.dataSource.getRepository(Employment);
    let manageableSubmitterIds: Set<string> | null = null;
    if (!isAdminOrOwner) {
      const subordinates = await employmentRepo.find({
        where: { reportsToId: actorId, tenantId },
        select: ['tenantMemberId'],
      });
      manageableSubmitterIds = new Set(subordinates.map((e) => e.tenantMemberId));
    }

    const visibleSubmissions = submissions.filter((sub) => {
      if (sub.memberId === actorId) return false;
      if (isAdminOrOwner) return true;
      return manageableSubmitterIds!.has(sub.memberId);
    });

    const submitterIds = [...new Set(visibleSubmissions.map((s) => s.memberId))];
    const members = submitterIds.length ? await memberRepo.findByIds(submitterIds) : [];
    const memberMap = new Map(members.map((m) => [m.id, m]));

    return visibleSubmissions.map((sub) => {
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
    const taskRepo = this.dataSource.getRepository(Task);
    const task = taskRepo.create({
      tenantId,
      title: data.title,
      description: data.description,
      points: data.points,
      icon: data.icon,
      category: data.category ?? undefined,
      imageUrl: data.imageUrl ?? undefined,
      submissionType: data.submissionType,
      isRecurring: data.isRecurring ?? false,
    });
    const saved = await taskRepo.save(task);
    if (actorMemberId) {
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
    }
    return saved;
  }

  async deleteTask(tenantId: string, taskId: string, actorMemberId?: string) {
    const taskRepo = this.dataSource.getRepository(Task);
    const task = await taskRepo.findOne({ where: { id: taskId, tenantId } });
    if (!task) {
      throw new BadRequestException('Task not found');
    }
    await taskRepo.remove(task);
    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'reward.task_deleted',
          resourceType: 'task',
          resourceId: taskId,
          description: `Task "${task.title}" deleted`,
          metadata: { title: task.title },
        })
        .catch(() => {});
    }
    return { success: true };
  }

  async submitTask(
    tenantId: string,
    taskId: string,
    memberId: string,
    data: {
      submissionText?: string;
      submissionFileName?: string;
    },
  ) {
    const taskRepo = this.dataSource.getRepository(Task);
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);

    const task = await taskRepo.findOne({ where: { id: taskId, tenantId } });
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    let sub = await submissionRepo.findOne({ where: { taskId, memberId, tenantId } });
    if (sub && sub.status === 'completed') {
      throw new BadRequestException('Task already completed');
    }

    const isInstant = task.submissionType === 'instant';
    const status: 'pending' | 'completed' | 'rejected' = isInstant ? 'completed' : 'pending';

    if (!sub) {
      sub = submissionRepo.create({
        tenantId,
        taskId,
        memberId,
        status,
        submissionText: data.submissionText ?? undefined,
        submissionFileName: data.submissionFileName ?? undefined,
      });
    } else {
      sub.status = status;
      sub.submissionText = data.submissionText ?? sub.submissionText;
      sub.submissionFileName = data.submissionFileName ?? sub.submissionFileName;
    }

    await submissionRepo.save(sub!);

    if (isInstant) {
      await this.pointsService.awardPointsForTask(tenantId, memberId, task.points, task.title);
    }

    return {
      success: true,
      status,
      pointsAwarded: isInstant ? task.points : 0,
    };
  }

  async approveSubmission(tenantId: string, taskId: string, submissionId: string, actorId: string) {
    const taskRepo = this.dataSource.getRepository(Task);
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);

    const sub = await submissionRepo.findOne({ where: { id: submissionId, tenantId, taskId } });
    if (!sub) {
      throw new BadRequestException('Submission not found');
    }
    if (sub.status === 'completed') {
      throw new BadRequestException('Submission already approved');
    }

    if (actorId === sub.memberId) {
      throw new BadRequestException('You cannot approve your own task submission');
    }

    const canApprove = await this.canActorApproveFor(tenantId, actorId, sub.memberId);
    if (!canApprove) {
      throw new BadRequestException(
        'You do not have permission to approve this submission. Only admins, owners, or the direct manager of the employee can approve.',
      );
    }

    const task = await taskRepo.findOne({ where: { id: taskId, tenantId } });
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    sub.status = 'completed';
    await submissionRepo.save(sub);

    await this.pointsService.awardPointsForTask(tenantId, sub.memberId, task.points, task.title);

    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: actorId,
        action: 'reward.submission_approved',
        resourceType: 'task_submission',
        resourceId: submissionId,
        description: `Task submission approved for "${task.title}"`,
        metadata: { taskId, submitterMemberId: sub.memberId, points: task.points },
      })
      .catch(() => {});

    return { success: true };
  }

  async rejectSubmission(tenantId: string, taskId: string, submissionId: string, actorId: string) {
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);

    const sub = await submissionRepo.findOne({ where: { id: submissionId, tenantId, taskId } });
    if (!sub) {
      throw new BadRequestException('Submission not found');
    }

    if (actorId === sub.memberId) {
      throw new BadRequestException('You cannot reject your own task submission');
    }

    const canApprove = await this.canActorApproveFor(tenantId, actorId, sub.memberId);
    if (!canApprove) {
      throw new BadRequestException('You do not have permission to reject this submission.');
    }

    sub.status = 'rejected';
    await submissionRepo.save(sub);

    const task = await this.dataSource
      .getRepository(Task)
      .findOne({ where: { id: taskId, tenantId } });

    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: actorId,
        action: 'reward.submission_rejected',
        resourceType: 'task_submission',
        resourceId: submissionId,
        description: `Task submission rejected for "${task?.title ?? taskId}"`,
        metadata: { taskId, submitterMemberId: sub.memberId },
      })
      .catch(() => {});

    return { success: true };
  }
}
