import { TeamsService } from './teams.service';

describe('TeamsService', () => {
  const setup = () => {
    const teamsRepository = {
      createTeam: jest.fn().mockResolvedValue({ id: 't1', name: 'Core' }),
    };
    const teamMembersRepository = {
      createTeamMembers: jest.fn().mockResolvedValue([]),
      createTeamMember: jest.fn().mockResolvedValue({ id: 'tm1' }),
    };
    const tenantMembersService = {
      getTenantMember: jest.fn().mockResolvedValue({ tenantId: 'x' }),
    };
    const activitiesService = { queueActivity: jest.fn().mockResolvedValue(undefined) };
    const service = new TeamsService(
      teamsRepository as never,
      teamMembersRepository as never,
      tenantMembersService as never,
      activitiesService as never,
    );
    return { service, teamMembersRepository, tenantMembersService };
  };

  it('createTeam persists all initial members in one batch', async () => {
    const { service, teamMembersRepository } = setup();

    await service.createTeam('x', 'actor', { name: 'Core', members: ['m1', 'm2'] } as never);

    expect(teamMembersRepository.createTeamMembers).toHaveBeenCalledTimes(1);
    expect(teamMembersRepository.createTeamMembers).toHaveBeenCalledWith([
      { teamId: 't1', memberId: 'm1' },
      { teamId: 't1', memberId: 'm2' },
    ]);
  });

  it('addTeamMember returns the persisted team member', async () => {
    const { service, teamMembersRepository } = setup();
    jest.spyOn(service, 'getTeam').mockResolvedValue({ id: 't1', name: 'Core' } as never);

    const result = await service.addTeamMember('x', 't1', { memberId: 'm1', role: 'dev' }, 'actor');

    expect(teamMembersRepository.createTeamMember).toHaveBeenCalledWith({
      teamId: 't1',
      memberId: 'm1',
      role: 'dev',
    });
    expect(result).toEqual({ id: 'tm1' });
  });
});
