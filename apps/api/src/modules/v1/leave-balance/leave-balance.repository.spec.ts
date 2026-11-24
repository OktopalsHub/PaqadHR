import { LeaveBalanceRepository } from './leave-balance.repository';

function build() {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['update', 'set', 'where', 'andWhere', 'setParameters']) {
    qb[m] = jest.fn().mockReturnValue(qb);
  }
  qb.execute = jest.fn().mockResolvedValue({ affected: 1 });
  const repo = { target: class {}, manager: {}, queryRunner: undefined, createQueryBuilder: () => qb };
  return { repository: new LeaveBalanceRepository(repo as never), qb };
}

describe('LeaveBalanceRepository.adjustUsedDays', () => {
  it('guards reservations against the remaining balance in the same statement', async () => {
    const { repository, qb } = build();
    await repository.adjustUsedDays('b1', 3);
    expect(qb.andWhere).toHaveBeenCalledWith('total_days - used_days >= :delta');
  });

  it('never lets used days go negative on release', async () => {
    const { repository, qb } = build();
    qb.execute.mockResolvedValue({ affected: 0 });
    expect(await repository.adjustUsedDays('b1', -3)).toBe(false);
    const set = qb.set.mock.calls[0][0] as { usedDays: () => string };
    expect(set.usedDays()).toContain('GREATEST');
  });
});
