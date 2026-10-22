import { PaymentMethodStatus } from 'src/common/enums/payment-method-status.enum';
import { TenantMemberRole } from 'src/common/enums/tenant-member.enum';
import type { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentMethodVerificationService } from './payment-method-verification.service';

describe('PaymentMethodVerificationService review notifications', () => {
  const createService = () => {
    const memberRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    const paymentMethodRepo = {
      findOne: jest.fn(),
      save: jest.fn(async (pm: PaymentMethod) => pm),
    };
    const notificationHelper = {
      sendPaymentMethodSubmittedAdminNotification: jest.fn().mockResolvedValue(undefined),
    };
    const auditLogsService = {
      queueAuditLog: jest.fn().mockResolvedValue(undefined),
    };
    const productAnalytics = {
      capture: jest.fn(),
    };

    const service = new PaymentMethodVerificationService(
      paymentMethodRepo as never,
      memberRepo as never,
      { assertOtpProof: jest.fn() } as never,
      auditLogsService as never,
      notificationHelper as never,
      { ensureOrVerifyPasscode: jest.fn().mockResolvedValue(undefined) } as never,
      { isEncrypted: () => false, decrypt: (v: string) => v } as never,
      productAnalytics as never,
    );

    return {
      service,
      memberRepo,
      paymentMethodRepo,
      notificationHelper,
    };
  };

  const pendingMethod = (memberId: string) =>
    ({
      id: 'pm-1',
      tenantId: 'tenant-1',
      memberId,
      status: PaymentMethodStatus.DRAFT,
      currency: 'NGN',
      isPrimary: false,
      member: { firstName: 'Ada', lastName: 'Lovelace' },
    }) as unknown as PaymentMethod;

  it('notifies only other admins and never the member who submitted the account', async () => {
    const { service, paymentMethodRepo, memberRepo, notificationHelper } = createService();
    paymentMethodRepo.findOne.mockResolvedValue(pendingMethod('member-submitter'));
    // One admin is the submitter, one admin is a colleague, one owner, one plain member.
    memberRepo.find.mockResolvedValue([
      { id: 'member-submitter', role: TenantMemberRole.ADMIN, isActive: true },
      { id: 'admin-colleague', role: TenantMemberRole.ADMIN, isActive: true },
      { id: 'owner-1', role: TenantMemberRole.OWNER, isActive: true },
      { id: 'plain-member', role: TenantMemberRole.MEMBER, isActive: true },
    ]);

    await service.submitForVerification('pm-1', 'tenant-1', 'member-submitter', 'user-1', {
      otpProof: 'proof',
      passcode: '1234',
    } as never);
    await new Promise(process.nextTick);

    expect(notificationHelper.sendPaymentMethodSubmittedAdminNotification).toHaveBeenCalledWith(
      ['admin-colleague', 'owner-1'],
      'tenant-1',
      expect.objectContaining({ employeeName: 'Ada Lovelace', paymentMethodId: 'pm-1' }),
    );
  });

  it('only targets active owners and admins', async () => {
    const { service, paymentMethodRepo, memberRepo } = createService();
    paymentMethodRepo.findOne.mockResolvedValue(pendingMethod('member-1'));
    memberRepo.find.mockResolvedValue([]);

    await service.submitForVerification('pm-1', 'tenant-1', 'member-1', 'user-1', {
      otpProof: 'proof',
      passcode: '1234',
    } as never);
    await new Promise(process.nextTick);

    expect(memberRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.arrayContaining([
          expect.objectContaining({ role: TenantMemberRole.ADMIN, isActive: true }),
          expect.objectContaining({ role: TenantMemberRole.OWNER, isActive: true }),
        ]),
      }),
    );
  });
});
