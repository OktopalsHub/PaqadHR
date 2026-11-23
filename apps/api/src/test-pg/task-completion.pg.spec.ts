import { randomUUID } from 'node:crypto';

import type { DataSource } from 'typeorm';

import { RewardsTaskCompletionService } from '../modules/v1/rewards/services/rewards-task-completion.service';
import { Task } from '../modules/v1/rewards/entities/task.entity';
import { TaskSubmission } from '../modules/v1/rewards/entities/task-submission.entity';
import { ShoutoutMemberPoints } from '../modules/v1/shoutouts/entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from '../modules/v1/shoutouts/entities/shoutout-point-transaction.entity';
import { TenantMember } from '../modules/v1/tenant-members/entities/tenant-member.entity';
import { createPgDataSource, PG_TEST_URL } from './pg-harness';

const maybe = PG_TEST_URL ? describe : describe.skip;

maybe('task completion awards (real Postgres)', () => {
  jest.setTimeout(180_000);
  let ds: DataSource;
  let service: RewardsTaskCompletionService;

  beforeAll(async () => {
    ds = await createPgDataSource();
    service = new RewardsTaskCompletionService(ds, {
      sendTaskCompletionPointsNotification: jest.fn().mockResolvedValue(undefined),
    } as never);
  });
  afterAll(async () => {
    await ds?.destroy();
  });

  async function seed(submissionType: 'instant' | 'approval', withPointsRow: boolean) {
    const tenantId = randomUUID();
    const memberId = randomUUID();
    const adminId = randomUUID();
    await ds.getRepository(TenantMember).insert([
      { id: memberId, tenantId, role: 'member' } as never,
      { id: adminId, tenantId, role: 'admin' } as never,
    ]);
    const taskId = randomUUID();
    await ds
      .getRepository(Task)
      .insert({ id: taskId, tenantId, title: 'Do it', points: 50, submissionType } as never);
    if (withPointsRow)
      await ds
        .getRepository(ShoutoutMemberPoints)
        .insert({ tenantId, memberId, currentBalance: 0, totalEarned: 0 });
    return { tenantId, memberId, adminId, taskId };
  }

  const balance = async (tenantId: string, memberId: string) =>
    ds.getRepository(ShoutoutMemberPoints).find({ where: { tenantId, memberId } });

  it('awards an approval task once when many approvers click at the same time', async () => {
    const { tenantId, memberId, adminId, taskId } = await seed('approval', true);
    await service.submitTask(tenantId, taskId, memberId, { submissionText: 'done' });
    const sub = await ds.getRepository(TaskSubmission).findOneByOrFail({ taskId, memberId });

    const results = await Promise.allSettled(
      Array.from({ length: 15 }, () => service.approveSubmission(tenantId, taskId, sub.id, adminId)),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const [row] = await balance(tenantId, memberId);
    expect(row.currentBalance).toBe(50);
    expect(
      await ds.getRepository(ShoutoutPointTransaction).count({ where: { tenantId, memberId } }),
    ).toBe(1);
  });

  it('awards an instant task once when the member submits it repeatedly in parallel', async () => {
    const { tenantId, memberId, taskId } = await seed('instant', true);

    const results = await Promise.allSettled(
      Array.from({ length: 15 }, () => service.submitTask(tenantId, taskId, memberId, {})),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const [row] = await balance(tenantId, memberId);
    expect(row.currentBalance).toBe(50);
  });

  it('creates one points row when the first award races for a member with no row yet', async () => {
    const { tenantId, memberId, taskId } = await seed('instant', false);

    await service.submitTask(tenantId, taskId, memberId, {});
    const second = await seed('instant', false);
    await Promise.allSettled([
      service.submitTask(second.tenantId, second.taskId, second.memberId, {}),
      service.submitTask(second.tenantId, second.taskId, second.memberId, {}),
    ]);

    expect(await balance(tenantId, memberId)).toHaveLength(1);
    const rows = await balance(second.tenantId, second.memberId);
    expect(rows).toHaveLength(1);
    expect(rows[0].currentBalance).toBe(50);
  });

  it('keeps one points row when one member completes two different tasks at once, first time', async () => {
    const one = await seed('instant', false);
    const taskTwo = randomUUID();
    await ds.getRepository(Task).insert({
      id: taskTwo,
      tenantId: one.tenantId,
      title: 'Second',
      points: 30,
      submissionType: 'instant',
    } as never);

    await Promise.allSettled([
      service.submitTask(one.tenantId, one.taskId, one.memberId, {}),
      service.submitTask(one.tenantId, taskTwo, one.memberId, {}),
    ]);

    const rows = await balance(one.tenantId, one.memberId);
    expect(rows).toHaveLength(1);
    expect(rows[0].currentBalance).toBe(80);
  });
});
