import { randomUUID } from 'node:crypto';

import type { DataSource } from 'typeorm';

import { MemberPointsRepository } from '../modules/v1/shoutouts/repositories/member-points.repository';
import { ShoutoutMemberPoints } from '../modules/v1/shoutouts/entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from '../modules/v1/shoutouts/entities/shoutout-point-transaction.entity';
import { PointsCalculationService } from '../modules/v1/shoutouts/services/points-calculation.service';
import { addMemberPoints } from '../modules/v1/shoutouts/utils/member-points-delta.util';
import { createPgDataSource, PG_TEST_URL } from './pg-harness';

const maybe = PG_TEST_URL ? describe : describe.skip;

maybe('shoutout sender allowance (real Postgres)', () => {
  jest.setTimeout(180_000);
  let ds: DataSource;
  let service: PointsCalculationService;

  beforeAll(async () => {
    ds = await createPgDataSource();
    const repo = new MemberPointsRepository(
      ds.getRepository(ShoutoutMemberPoints),
      ds.getRepository(ShoutoutPointTransaction),
    );
    service = new PointsCalculationService(repo, {
      getPointsSettings: jest.fn().mockResolvedValue({ monthlyAllowance: 100 }),
      getPointsStartingBalance: jest.fn().mockResolvedValue(0),
      validatePointsOperation: jest.fn().mockResolvedValue({ isValid: true }),
    } as never);
  });
  afterAll(async () => {
    await ds?.destroy();
  });

  const sendShoutout = (tenantId: string, senderId: string, cost: number) =>
    ds.transaction(async (manager) => {
      await service.validateSenderAllowance(tenantId, senderId, cost, manager);
      await addMemberPoints(manager, tenantId, senderId, { monthlyGiven: cost, given: cost });
    });

  it('lets concurrent shoutouts spend the monthly allowance only once', async () => {
    const tenantId = randomUUID();
    const senderId = randomUUID();
    await ds.getRepository(ShoutoutMemberPoints).insert({
      tenantId,
      memberId: senderId,
      lastResetDate: new Date(),
    });

    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => sendShoutout(tenantId, senderId, 30)),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    const row = await ds.getRepository(ShoutoutMemberPoints).findOneByOrFail({
      tenantId,
      memberId: senderId,
    });
    expect(row.monthlyGiven).toBe(90);
    expect(row.totalGiven).toBe(90);
  });

  it('creates one points row when a member is first seen by concurrent requests', async () => {
    const tenantId = randomUUID();
    const memberId = randomUUID();

    await Promise.all(
      Array.from({ length: 10 }, () =>
        ds.transaction((manager) => service.ensureMemberRow(tenantId, memberId, manager)),
      ),
    );

    expect(await ds.getRepository(ShoutoutMemberPoints).count({ where: { tenantId, memberId } })).toBe(1);
  });
});
