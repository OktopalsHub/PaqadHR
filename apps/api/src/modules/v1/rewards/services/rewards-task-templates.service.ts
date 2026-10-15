import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Task } from '../entities/task.entity';

const DEFAULT_TASKS = [
  {
    title: 'Welcome Tour',
    description: 'Take a quick 2-minute tour of the workspace and navigation.',
    points: 10,
    icon: 'Compass',
    category: 'Onboarding',
    imageUrl:
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=150&auto=format&fit=crop&q=60',
    submissionType: 'instant' as const,
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
    submissionType: 'file' as const,
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
    submissionType: 'instant' as const,
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
    submissionType: 'file' as const,
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
    submissionType: 'text' as const,
    isRecurring: true,
  },
];

@Injectable()
export class RewardsTaskTemplatesService {
  constructor(private readonly dataSource: DataSource) {}

  async ensureDefaultTasks(tenantId: string): Promise<boolean> {
    const taskRepo = this.dataSource.getRepository(Task);
    const count = await taskRepo.count({ where: { tenantId } });
    if (count > 0) return false;
    for (const d of DEFAULT_TASKS) await taskRepo.save(taskRepo.create({ tenantId, ...d }));
    return true;
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
  ) {
    const taskRepo = this.dataSource.getRepository(Task);
    const task = taskRepo.create({
      tenantId,
      ...data,
      category: data.category ?? undefined,
      imageUrl: data.imageUrl ?? undefined,
      isRecurring: data.isRecurring ?? false,
    });
    return taskRepo.save(task);
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
  ) {
    const taskRepo = this.dataSource.getRepository(Task);
    const task = await taskRepo.findOne({ where: { id: taskId, tenantId } });
    if (!task) throw new BadRequestException('Task not found');
    if (data.title !== undefined) task.title = data.title;
    if (data.description !== undefined) task.description = data.description;
    if (data.points !== undefined) task.points = data.points;
    if (data.icon !== undefined) task.icon = data.icon;
    if (data.category !== undefined) task.category = data.category || undefined;
    if (data.imageUrl !== undefined) task.imageUrl = data.imageUrl || undefined;
    if (data.submissionType !== undefined) task.submissionType = data.submissionType;
    if (data.isRecurring !== undefined) task.isRecurring = data.isRecurring;
    return taskRepo.save(task);
  }

  async deleteTask(tenantId: string, taskId: string) {
    const taskRepo = this.dataSource.getRepository(Task);
    const task = await taskRepo.findOne({ where: { id: taskId, tenantId } });
    if (!task) throw new BadRequestException('Task not found');
    await taskRepo.remove(task);
    return { success: true };
  }
}
