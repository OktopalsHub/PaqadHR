import type { EntityManager } from 'typeorm';

import { ShoutoutMemberPoints } from '../entities/shoutout-member-points.entity';

export type MemberPointsDelta = {
  balance?: number;
  earned?: number;
  given?: number;
  monthlyGiven?: number;
  monthlyReceived?: number;
};

const COLUMNS: Record<keyof MemberPointsDelta, { property: string; column: string; param: string }> = {
  balance: { property: 'currentBalance', column: 'current_balance', param: 'dBalance' },
  earned: { property: 'totalEarned', column: 'total_earned', param: 'dEarned' },
  given: { property: 'totalGiven', column: 'total_given', param: 'dGiven' },
  monthlyGiven: { property: 'monthlyGiven', column: 'monthly_given', param: 'dMonthlyGiven' },
  monthlyReceived: { property: 'monthlyReceived', column: 'monthly_received', param: 'dMonthlyReceived' },
};

/**
 * Apply point changes as one SQL increment, so concurrent credits and debits cannot overwrite
 * each other with a stale absolute value. Returns the balance after the change.
 */
export async function addMemberPoints(
  manager: EntityManager,
  tenantId: string,
  memberId: string,
  delta: MemberPointsDelta,
): Promise<number> {
  const set: Record<string, () => string> = {};
  const params: Record<string, number | string> = { tenantId, memberId };
  for (const key of Object.keys(delta) as (keyof MemberPointsDelta)[]) {
    const value = delta[key];
    if (!value) continue;
    const { property, column, param } = COLUMNS[key];
    set[property] = () => `${column} + :${param}`;
    params[param] = value;
  }
  const repo = manager.getRepository(ShoutoutMemberPoints);
  const query = repo
    .createQueryBuilder()
    .update(ShoutoutMemberPoints)
    .where('tenant_id = :tenantId AND member_id = :memberId')
    .setParameters(params)
    .returning('current_balance');
  if (Object.keys(set).length === 0) {
    const row = await repo.findOneOrFail({ where: { tenantId, memberId } });
    return row.currentBalance;
  }
  const result = await query.set(set as never).execute();
  const balance = (result.raw as { current_balance: number }[])[0]?.current_balance;
  if (balance === undefined) throw new Error('Member points row not found');
  return Number(balance);
}
