import { randomUUID } from 'node:crypto';

import type { DataSource } from 'typeorm';

import { LeaveBalance } from '../modules/v1/leave-balance/entities/leave-balance.entity';
import { LeaveBalanceRepository } from '../modules/v1/leave-balance/leave-balance.repository';
import { ShoutoutMemberPoints } from '../modules/v1/shoutouts/entities/shoutout-member-points.entity';
import { addMemberPoints } from '../modules/v1/shoutouts/utils/member-points-delta.util';
import { createPgDataSource, PG_TEST_URL } from './pg-harness';

const maybe = PG_TEST_URL ? describe : describe.skip;

maybe('concurrent points and leave balances (real Postgres)', () => {
  jest.setTimeout(180_000);
  let ds: DataSource;

  beforeAll(async () => {
    ds = await createPgDataSource();
  });
  afterAll(async () => {
    await ds?.destroy();
  });

  it('applies every concurrent point credit and debit exactly once', async () => {
    const tenantId = randomUUID();
    const memberId = randomUUID();
    await ds.getRepository(ShoutoutMemberPoints).insert({
      tenantId,
      memberId,
      currentBalance: 1000,
      totalEarned: 0,
    });

    await Promise.all([
      ...Array.from({ length: 40 }, () =>
        ds.transaction((m) => addMemberPoints(m, tenantId, memberId, { balance: 5, earned: 5 })),
      ),
      ...Array.from({ length: 20 }, () =>
        ds.transaction((m) => addMemberPoints(m, tenantId, memberId, { balance: -3 })),
      ),
    ]);

    const row = await ds.getRepository(ShoutoutMemberPoints).findOneByOrFail({ tenantId, memberId });
    expect(row.currentBalance).toBe(1000 + 40 * 5 - 20 * 3);
    expect(row.totalEarned).toBe(40 * 5);
  });

  it('never reserves more leave days than the balance holds', async () => {
    const tenantId = randomUUID();
    const repo = ds.getRepository(LeaveBalance);
    const saved = await repo.save(
      repo.create({
        tenantId,
        memberId: randomUUID(),
        leaveTypeId: randomUUID(),
        totalDays: 10,
        usedDays: 0,
        remainingDays: 10,
        regularDays: 10,
        year: 2026,
      }),
    );
    const leaveRepo = new LeaveBalanceRepository(repo);

    const results = await Promise.all(
      Array.from({ length: 25 }, () => leaveRepo.adjustUsedDays(saved.id, 1)),
    );

    const row = await repo.findOneByOrFail({ id: saved.id });
    expect(results.filter(Boolean)).toHaveLength(10);
    expect(row.usedDays).toBe(10);
    expect(row.remainingDays).toBe(0);
  });

  it('releases days without going below zero', async () => {
    const tenantId = randomUUID();
    const repo = ds.getRepository(LeaveBalance);
    const saved = await repo.save(
      repo.create({
        tenantId,
        memberId: randomUUID(),
        leaveTypeId: randomUUID(),
        totalDays: 10,
        usedDays: 2,
        remainingDays: 8,
        regularDays: 10,
        year: 2026,
      }),
    );
    const leaveRepo = new LeaveBalanceRepository(repo);

    await Promise.all(Array.from({ length: 6 }, () => leaveRepo.adjustUsedDays(saved.id, -1)));

    const row = await repo.findOneByOrFail({ id: saved.id });
    expect(row.usedDays).toBe(0);
    expect(row.remainingDays).toBe(10);
  });
});
