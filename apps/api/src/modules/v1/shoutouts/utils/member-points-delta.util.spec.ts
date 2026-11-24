import { addMemberPoints } from './member-points-delta.util';

function build(raw: unknown[] = [{ current_balance: '25' }]) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['update', 'where', 'setParameters', 'returning', 'set']) {
    qb[m] = jest.fn().mockReturnValue(qb);
  }
  qb.execute = jest.fn().mockResolvedValue({ raw });
  const manager = { getRepository: () => ({ createQueryBuilder: () => qb, findOneOrFail: jest.fn() }) };
  return { manager, qb };
}

describe('addMemberPoints', () => {
  it('increments in SQL instead of writing an absolute value', async () => {
    const { manager, qb } = build();
    const balance = await addMemberPoints(manager as never, 't', 'm', { balance: 5, earned: 5 });
    expect(balance).toBe(25);
    const set = qb.set.mock.calls[0][0] as Record<string, () => string>;
    expect(set.currentBalance()).toBe('current_balance + :dBalance');
    expect(set.totalEarned()).toBe('total_earned + :dEarned');
    expect(qb.setParameters).toHaveBeenCalledWith(
      expect.objectContaining({ dBalance: 5, dEarned: 5, tenantId: 't', memberId: 'm' }),
    );
  });

  it('fails when the member row does not exist', async () => {
    const { manager } = build([]);
    await expect(addMemberPoints(manager as never, 't', 'm', { balance: 1 })).rejects.toThrow(
      'Member points row not found',
    );
  });
});
