import { Repository } from 'typeorm';

import type { Team } from '../entities/team.entity';
import { TeamsRepository } from './teams.repository';

describe('TeamsRepository', () => {
  it('createTeam persists the built entity and returns the saved one', async () => {
    const base = {
      target: Object,
      manager: {},
      queryRunner: undefined,
    } as unknown as Repository<Team>;
    const repo = new TeamsRepository(base);
    const built = { name: 'Core' } as Team;
    const saved = { id: 't1', name: 'Core' } as Team;
    jest.spyOn(Repository.prototype, 'create').mockReturnValue(built as never);
    const save = jest.spyOn(repo, 'save').mockResolvedValue(saved as never);

    const result = await repo.createTeam({ name: 'Core' });

    expect(save).toHaveBeenCalledWith(built);
    expect(result).toBe(saved);
  });
});
