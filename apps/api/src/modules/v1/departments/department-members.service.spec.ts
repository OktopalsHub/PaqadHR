import { DepartmentMembersService } from './department-members.service';

describe('DepartmentMembersService.getDepartmentMembers', () => {
  it('selects only summary columns and paginates', async () => {
    const departmentsRepository = { findOne: jest.fn().mockResolvedValue({ id: 'dept-1' }) };
    const departmentMembersRepository = {
      find: jest.fn().mockResolvedValue([{ member: { id: 'm1' } }]),
    };
    const service = new DepartmentMembersService(
      departmentsRepository as never,
      departmentMembersRepository as never,
      {} as never,
      {} as never,
    );

    const members = await service.getDepartmentMembers('tenant-1', 'dept-1');

    const options = departmentMembersRepository.find.mock.calls[0][0];
    expect(options.take).toBe(50);
    expect(options.skip).toBe(0);
    expect(options.select.member).toEqual({
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      role: true,
      isActive: true,
      avatarKey: true,
    });
    expect(members).toEqual([{ id: 'm1' }]);
  });

  it('caps the limit at 200 and honours page', async () => {
    const departmentMembersRepository = { find: jest.fn().mockResolvedValue([]) };
    const service = new DepartmentMembersService(
      { findOne: jest.fn().mockResolvedValue({ id: 'dept-1' }) } as never,
      departmentMembersRepository as never,
      {} as never,
      {} as never,
    );

    await service.getDepartmentMembers('tenant-1', 'dept-1', 3, 9999);

    const options = departmentMembersRepository.find.mock.calls[0][0];
    expect(options.take).toBe(200);
    expect(options.skip).toBe(400);
  });
});
