import { UsersService } from './users.service';

describe('UsersService', () => {
  const createService = () => {
    const userRepository = {
      findUser: jest.fn(),
      softDelete: jest.fn(),
      update: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn(),
      getRepository: jest.fn(),
      manager: { getRepository: jest.fn() },
    };
    const auditLogsService = { queueAuditLog: jest.fn().mockResolvedValue(undefined) };
    const r2Service = { deleteFile: jest.fn().mockResolvedValue(undefined) };
    const encryptionService = { decrypt: jest.fn((v: string) => v) };

    const service = new UsersService(
      userRepository as never,
      dataSource as never,
      auditLogsService as never,
      r2Service as never,
      encryptionService as never,
    );

    return {
      service,
      userRepository,
      dataSource,
      r2Service,
      auditLogsService,
    };
  };

  const emptyMemberExportRepos = {
    find: jest.fn().mockResolvedValue([]),
  };

  it('exports user profile and memberships', async () => {
    const { service, userRepository, dataSource, auditLogsService } = createService();
    (userRepository.findUser as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
      createdAt: new Date(),
    });
    (dataSource.getRepository as jest.Mock).mockReturnValue(emptyMemberExportRepos);
    (dataSource.manager.getRepository as jest.Mock).mockReturnValue(emptyMemberExportRepos);

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
    const { service, userRepository, dataSource, r2Service } = createService();

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
    const memberFind = jest.fn().mockResolvedValue([]);

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
          if (name === 'TenantMember' || name.includes('TenantMember')) {
            return { find: memberFind, update: jest.fn(), softDelete: jest.fn() };
          }
          return {
            find: jest.fn().mockResolvedValue([]),
            delete: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: () => ({
              update: jest.fn().mockReturnThis(),
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              execute: jest.fn(),
            }),
          };
        },
      };
      return cb(manager);
    });

    await service.deleteAccount('user-1');

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(memberFind).toHaveBeenCalled();
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
  });

  it('does not purge files when the transaction fails', async () => {
    const { service, userRepository, dataSource, r2Service } = createService();

    (userRepository.findUser as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      imageKey: 'avatars/user.png',
    });
    (dataSource.transaction as jest.Mock).mockRejectedValue(new Error('db failed'));

    await expect(service.deleteAccount('user-1')).rejects.toThrow('db failed');
    expect(r2Service.deleteFile).not.toHaveBeenCalled();
  });

  it('audits failed file keys when R2 purge fails after commit', async () => {
    const { service, userRepository, dataSource, r2Service, auditLogsService } = createService();

    (userRepository.findUser as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      imageKey: 'avatars/user.png',
    });
    (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
      const manager = {
        getRepository: (entity: { name?: string }) => {
          const name = entity.name ?? String(entity);
          if (name.includes('Verification')) {
            return {
              delete: jest.fn(),
              createQueryBuilder: () => ({
                delete: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn(),
              }),
            };
          }
          if (name.includes('TenantMember')) {
            return {
              find: jest.fn().mockResolvedValue([]),
              update: jest.fn(),
              softDelete: jest.fn(),
            };
          }
          return {
            delete: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            createQueryBuilder: () => ({
              update: jest.fn().mockReturnThis(),
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              execute: jest.fn(),
            }),
          };
        },
      };
      return cb(manager);
    });
    (r2Service.deleteFile as jest.Mock).mockRejectedValue(new Error('r2 down'));

    await service.deleteAccount('user-1');

    expect(r2Service.deleteFile).toHaveBeenCalledTimes(2);
    expect(auditLogsService.queueAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'FAILED',
        metadata: expect.objectContaining({
          failedFileKeys: ['avatars/user.png'],
        }),
      }),
    );
  });
});
