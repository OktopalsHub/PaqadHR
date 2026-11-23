import { randomUUID } from 'node:crypto';

import type { DataSource } from 'typeorm';

import { RewardRedemption } from '../modules/v1/rewards/entities/reward-redemption.entity';
import { RewardsService } from '../modules/v1/rewards/services/rewards.service';
import { createMigratedDataSource, PG_TEST_URL } from './pg-harness';

const maybe = PG_TEST_URL ? describe : describe.skip;

maybe('voucher encryption at rest (real migrated Postgres)', () => {
  jest.setTimeout(240_000);
  let ds: DataSource;
  let tenantId: string;
  let memberId: string;

  beforeAll(async () => {
    ds = await createMigratedDataSource();
    const userId = randomUUID();
    tenantId = randomUUID();
    memberId = randomUUID();
    await ds.query('INSERT INTO "user" (id, email) VALUES ($1, $2)', [userId, `${userId}@example.com`]);
    await ds.query(
      'INSERT INTO tenants (id, name, slug, invite_code, created_by) VALUES ($1,$2,$3,$4,$5)',
      [tenantId, 'Acme', `acme-${tenantId.slice(0, 8)}`, tenantId.slice(0, 6), userId],
    );
    await ds.query('INSERT INTO tenant_members (id, tenant_id, user_id) VALUES ($1,$2,$3)', [
      memberId,
      tenantId,
      userId,
    ]);
  });
  afterAll(async () => {
    await ds?.destroy();
  });

  const raw = async (id: string) =>
    (await ds.query('SELECT voucher FROM reward_redemptions WHERE id = $1', [id]))[0].voucher;

  async function insertPlain(code: string) {
    const id = randomUUID();
    await ds.query(
      `INSERT INTO reward_redemptions (id, tenant_id, member_id, reward_type, points_spent, currency_value, voucher)
       VALUES ($1,$2,$3,'TREMENDOUS',10,5,$4::jsonb)`,
      [id, tenantId, memberId, JSON.stringify({ code, instructions: 'hi' })],
    );
    return id;
  }

  it('stores new vouchers encrypted and reads them back as plaintext', async () => {
    const repo = ds.getRepository(RewardRedemption);
    const saved = await repo.save(
      repo.create({
        tenantId,
        memberId,
        rewardType: 'TREMENDOUS',
        pointsSpent: 10,
        currencyValue: 5,
        voucher: { code: 'GIFT-SECRET-1', instructions: 'hi' },
      }),
    );
    expect((await raw(saved.id)).code).not.toContain('GIFT-SECRET-1');
    expect((await repo.findOneByOrFail({ id: saved.id })).voucher?.code).toBe('GIFT-SECRET-1');
  });

  it('seals a legacy plaintext row on first read and still returns the code', async () => {
    const id = await insertPlain('LEGACY-CODE-9');
    expect((await raw(id)).code).toBe('LEGACY-CODE-9');
    const service = new RewardsService(ds, ...([] as unknown as ConstructorParameters<typeof RewardsService> extends [unknown, ...infer R] ? R : never));
    const claims = await service.getMyClaims(tenantId, memberId);
    expect(claims.find((c) => c.id === id)?.voucher?.code).toBe('LEGACY-CODE-9');
    expect((await raw(id)).code.startsWith('enc1.')).toBe(true);
  });
});
