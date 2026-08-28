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
    const verificationRepository = {
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const tenantMemberRepository = {
      find: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };
    const paymentMethodRepository = {
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
    };
    const employmentRepository = { find: jest.fn(), update: jest.fn() };
    const documentRepository = {
      find: jest.fn(),
      delete: jest.fn(),
    };
    const leaveRepository = { find: jest.fn(), update: jest.fn() };
    const attendanceRepository = { find: jest.fn(), update: jest.fn() };
    const educationRepository = { find: jest.fn(), delete: jest.fn() };
    const emergencyContactRepository = { find: jest.fn(), delete: jest.fn() };
    const addressRepository = { find: jest.fn(), delete: jest.fn() };
    const payrollItemRepository = { find: jest.fn() };
    const notificationPreferenceRepository = { find: jest.fn() };
    const notificationRepository = { find: jest.fn(), delete: jest.fn() };
    const auditLogsService = { queueAuditLog: jest.fn().mockResolvedValue(undefined) };
    const r2Service = { deleteFile: jest.fn().mockResolvedValue(undefined) };
    const encryptionService = { decrypt: jest.fn() };

    verificationRepository.createQueryBuilder.mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    });

    const service = new UsersService(
      userRepository as never,
      sessionRepository as never,
      accountRepository as never,
      verificationRepository as never,
      tenantMemberRepository as never,
      paymentMethodRepository as never,
      employmentRepository as never,
      documentRepository as never,
      leaveRepository as never,
      attendanceRepository as never,
      educationRepository as never,
      emergencyContactRepository as never,
      addressRepository as never,
      payrollItemRepository as never,
      notificationPreferenceRepository as never,
      notificationRepository as never,
      auditLogsService as never,
      r2Service as never,
      encryptionService as never,
    );

    return {
      service,
      userRepository,
      sessionRepository,
      accountRepository,
      verificationRepository,
      tenantMemberRepository,
      paymentMethodRepository,
      documentRepository,
      emergencyContactRepository,
      r2Service,
      auditLogsService,
    };
  };

  it('exports user profile and memberships', async () => {
    const { service, userRepository, tenantMemberRepository, auditLogsService } = createService();
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
    expect(auditLogsService.queueAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DATA_EXPORT' }),
    );
  });

  it('rejects registration without consent', () => {
    const { service } = createService();
    expect(() => service.validateRegistrationConsent(false)).toThrow();
  });

  it('scrubs linked member data and purges files when deleting account', async () => {
    const {
      service,
      userRepository,
      tenantMemberRepository,
      paymentMethodRepository,
      sessionRepository,
      accountRepository,
      verificationRepository,
      documentRepository,
      emergencyContactRepository,
      r2Service,
    } = createService();

    (userRepository.findUser as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      imageKey: 'avatars/user.png',
    });
    (tenantMemberRepository.find as jest.Mock).mockResolvedValue([
      { id: 'member-1', avatarKey: 'avatars/member.png' },
    ]);
    (documentRepository.find as jest.Mock).mockResolvedValue([
      { id: 'doc-1', fileKey: 'tenants/t1/documents/passport.pdf' },
    ]);
    (paymentMethodRepository.createQueryBuilder as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    });

    await service.deleteAccount('user-1');

    expect(documentRepository.delete).toHaveBeenCalled();
    expect(emergencyContactRepository.delete).toHaveBeenCalled();
    expect(verificationRepository.delete).toHaveBeenCalled();
    expect(tenantMemberRepository.update).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({
        isActive: false,
        firstName: null,
        identityBvn: null,
        avatarKey: null,
      }),
    );
    expect(tenantMemberRepository.softDelete).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(sessionRepository.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(accountRepository.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(userRepository.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        metadata: null,
        email: expect.stringMatching(/^deleted_\d+_[a-f0-9]+@anonymized\.paqad\.local$/),
      }),
    );
    expect(userRepository.softDelete).toHaveBeenCalledWith('user-1');
    expect(r2Service.deleteFile).toHaveBeenCalledWith('avatars/user.png');
    expect(r2Service.deleteFile).toHaveBeenCalledWith('avatars/member.png');
    expect(r2Service.deleteFile).toHaveBeenCalledWith('tenants/t1/documents/passport.pdf');
  });
});
