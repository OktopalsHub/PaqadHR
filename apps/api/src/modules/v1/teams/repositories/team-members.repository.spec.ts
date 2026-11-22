import { Repository } from 'typeorm';

import type { TeamMember } from '../entities/team-member.entity';
import { TeamMembersRepository } from './team-members.repository';

describe('TeamMembersRepository', () => {
  const build = () => {
    const base = {
      target: Object,
      manager: {},
      queryRunner: undefined,
    } as unknown as Repository<TeamMember>;
    return new TeamMembersRepository(base);
  };

  afterEach(() => jest.restoreAllMocks());

  it('createTeamMember persists the built entity and returns the saved one', async () => {
    const repo = build();
    const built = { teamId: 't1', memberId: 'm1' } as TeamMember;
    const saved = { ...built, id: 'tm1' } as TeamMember;
    jest.spyOn(Repository.prototype, 'create').mockReturnValue(built as never);
    const save = jest.spyOn(repo, 'save').mockResolvedValue(saved as never);

    const result = await repo.createTeamMember({ teamId: 't1', memberId: 'm1' });

    expect(save).toHaveBeenCalledWith(built);
    expect(result).toBe(saved);
  });

  it('createTeamMembers saves all entities in a single batch', async () => {
    const repo = build();
    const built = [{ memberId: 'm1' }, { memberId: 'm2' }] as TeamMember[];
    const saved = built.map((m, i) => ({ ...m, id: `tm${i}` })) as TeamMember[];
    jest.spyOn(Repository.prototype, 'create').mockReturnValue(built as never);
    const save = jest.spyOn(repo, 'save').mockResolvedValue(saved as never);

    const result = await repo.createTeamMembers([{ memberId: 'm1' }, { memberId: 'm2' }]);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(built);
    expect(result).toBe(saved);
  });

  it('createTeamMembers skips the database for an empty list', async () => {
    const repo = build();
    const save = jest.spyOn(repo, 'save');

    await expect(repo.createTeamMembers([])).resolves.toEqual([]);
    expect(save).not.toHaveBeenCalled();
  });
});
