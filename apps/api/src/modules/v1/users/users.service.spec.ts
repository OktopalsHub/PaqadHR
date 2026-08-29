import { UsersService } from './users.service';

describe('UsersService', () => {
  const createService = () => {
    const userRepository = {
      findUser: jest.fn(),
      softDelete: jest.fn(),
      update: jest.fn(),
    };
    const tenantMembersService = {
      scrubPersonalData: jest.fn(),
      loadPersonalDataForExport: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn(),
    };
    const auditLogsService = { queueAuditLog: jest.fn().mockResolvedValue(undefined) };
    const r2Service = { deleteFile: jest.fn().mockResolvedValue(undefined) };

    const service = new UsersService(
      userRepository as never,
      tenantMembersService as never,
      dataSource as never,
      auditLogsService as never,
      r2Service as never,
    );

    return {
      service,
      userRepository,
      tenantMembersService,
      dataSource,
      r2Service,
      auditLogsService,
    };
  };

  it('exports user profile and memberships', async () => {
    const { service, userRepository, tenantMembersService, auditLogsService } = createService();
    (userRepository.findUser as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
      createdAt: new Date(),
    });
    (tenantMembersService.loadPersonalDataForExport as jest.Mock).mockResolvedValue({
      memberships: [],
      employment: [],
      documents: [],
      leaves: [],
      attendance: [],
      education: [],
      emergencyContacts: [],
      addresses: [],
      payrollItems: [],
      paymentMethods: [],
      notificationPreferences: [],
      notifications: [],
    });

    const data = await service.exportUserData('user-1');

    expect(data.profile).toMatchObject({ email: 'test@example.com' });
    expect(data.memberships).toEqual([]);
    expect(auditLogsService.queueAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DATA_EXPORT' }),
    );
  });

  it('rejects registration without consent', () => {
    const { service } = createService();
    expect(() => service.validateRegistrationConsent(false)).toThrow();
  });

  it('scrubs linked member data and purges files when deleting account', async () => {
    const { service, userRepository, tenantMembersService, dataSource, r2Service } =
      createService();

    (userRepository.findUser as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      imageKey: 'avatars/user.png',
    });

    const sessionDelete = jest.fn();
    const accountDelete = jest.fn();
    const verificationDelete = jest.fn();
    const verificationQb = {
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const userUpdate = jest.fn();
    const userSoftDelete = jest.fn();

    (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
      const manager = {
        getRepository: (entity: { name?: string }) => {
          const name = entity.name ?? String(entity);
          if (name === 'Session' || name.includes('Session')) {
            return { delete: sessionDelete };
          }
          if (name === 'Account' || name.includes('Account')) {
            return { delete: accountDelete };
          }
          if (name === 'Verification' || name.includes('Verification')) {
            return { delete: verificationDelete, createQueryBuilder: () => verificationQb };
          }
          if (name === 'User' || name.includes('User')) {
            return { update: userUpdate, softDelete: userSoftDelete };
          }
          return {};
        },
      };
      return cb(manager);
    });

    (tenantMembersService.scrubPersonalData as jest.Mock).mockResolvedValue({
      membershipCount: 1,
      fileKeys: ['avatars/member.png', 'tenants/t1/documents/passport.pdf'],
    });

    await service.deleteAccount('user-1');

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(tenantMembersService.scrubPersonalData).toHaveBeenCalledWith(
      'user-1',
      expect.anything(),
    );
    expect(sessionDelete).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(accountDelete).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(userUpdate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        metadata: null,
        email: expect.stringMatching(/^deleted_\d+_[a-f0-9]+@anonymized\.paqad\.local$/),
      }),
    );
    expect(userSoftDelete).toHaveBeenCalledWith('user-1');
    expect(r2Service.deleteFile).toHaveBeenCalledWith('avatars/user.png');
    expect(r2Service.deleteFile).toHaveBeenCalledWith('avatars/member.png');
    expect(r2Service.deleteFile).toHaveBeenCalledWith('tenants/t1/documents/passport.pdf');
  });

  it('does not purge files when the transaction fails', async () => {
    const { service, userRepository, tenantMembersService, dataSource, r2Service } =
      createService();

    (userRepository.findUser as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      imageKey: 'avatars/user.png',
    });
    (dataSource.transaction as jest.Mock).mockRejectedValue(new Error('db failed'));
    (tenantMembersService.scrubPersonalData as jest.Mock).mockResolvedValue({
      membershipCount: 1,
      fileKeys: ['avatars/member.png'],
    });

    await expect(service.deleteAccount('user-1')).rejects.toThrow('db failed');
    expect(r2Service.deleteFile).not.toHaveBeenCalled();
  });
});
