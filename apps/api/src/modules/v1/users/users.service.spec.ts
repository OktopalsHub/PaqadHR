import { UsersService } from './users.service';

describe('UsersService', () => {
  const createService = () => {
    const userRepository = {
      findUser: jest.fn(),
      softDelete: jest.fn(),
      update: jest.fn(),
    };
    const sessionRepository = { delete: jest.fn() };
    const accountRepository = { delete: jest.fn() };
    const tenantMemberRepository = {
      find: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };
    const paymentMethodRepository = {
      createQueryBuilder: jest.fn(),
    };

    const service = new UsersService(
      userRepository as never,
      sessionRepository as never,
      accountRepository as never,
      tenantMemberRepository as never,
      paymentMethodRepository as never,
    );

    return {
      service,
      userRepository,
      sessionRepository,
      accountRepository,
      tenantMemberRepository,
      paymentMethodRepository,
    };
  };

  it('exports user profile and memberships', async () => {
    const { service, userRepository, tenantMemberRepository } = createService();
    (userRepository.findUser as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
      createdAt: new Date(),
    });
    (tenantMemberRepository.find as jest.Mock).mockResolvedValue([]);

    const data = await service.exportUserData('user-1');

    expect(data.profile).toMatchObject({ email: 'test@example.com' });
    expect(data.memberships).toEqual([]);
  });

  it('rejects registration without consent', () => {
    const { service } = createService();
    expect(() => service.validateRegistrationConsent(false)).toThrow();
  });

  it('deactivates and soft-deletes tenant memberships when deleting account', async () => {
    const {
      service,
      userRepository,
      tenantMemberRepository,
      paymentMethodRepository,
      sessionRepository,
      accountRepository,
    } = createService();

    (userRepository.findUser as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    });
    (tenantMemberRepository.find as jest.Mock).mockResolvedValue([{ id: 'member-1' }]);
    (paymentMethodRepository.createQueryBuilder as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    });

    await service.deleteAccount('user-1');

    expect(tenantMemberRepository.update).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({ isActive: false }),
    );
    expect(tenantMemberRepository.softDelete).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(sessionRepository.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(accountRepository.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(userRepository.softDelete).toHaveBeenCalledWith('user-1');
  });
});
