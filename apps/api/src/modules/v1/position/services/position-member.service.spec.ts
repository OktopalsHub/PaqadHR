import { PositionMemberService } from './position-member.service';

describe('PositionMemberService.getMembersByPosition', () => {
  it('selects explicit columns instead of whole entities', async () => {
    const qb: Record<string, jest.Mock> = {};
    for (const name of ['innerJoin', 'leftJoin', 'select', 'where', 'andWhere', 'orderBy']) {
      qb[name] = jest.fn().mockReturnValue(qb);
    }
    qb.innerJoinAndSelect = jest.fn().mockReturnValue(qb);
    qb.getMany = jest.fn().mockResolvedValue([]);
    const repository = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const service = new PositionMemberService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.getMembersByPosition('tenant-1', 'position-1');

    expect(qb.innerJoinAndSelect).not.toHaveBeenCalled();
    const selected = qb.select.mock.calls[0][0] as string[];
    expect(selected).toEqual(
      expect.arrayContaining(['member.id', 'member.firstName', 'member.lastName']),
    );
    expect(selected).not.toContain('member');
  });
});
