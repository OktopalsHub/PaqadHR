import { ForbiddenException } from '@nestjs/common';
import { PaymentMethodStatus } from '../../../../common/enums/payment-method-status.enum';
import { EncryptionService } from '../../../../common/services/encryption.service';
import type { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentMethodService } from './payment-method.service';

describe('PaymentMethodService encryption and masking', () => {
  const encryptionService = new EncryptionService();

  const createService = () => {
    const service = new PaymentMethodService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      encryptionService,
      { log: jest.fn() } as never,
      {} as never,
      { getPayrollCurrencies: jest.fn(), requireIdentityForPayroll: jest.fn() } as never,
      { getTenant: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return service;
  };

  it('encrypts and decrypts bank fields round-trip', () => {
    const service = createService();
    const encrypt = (
      service as unknown as { encryptField: (v: string) => string }
    ).encryptField.bind(service);
    const decrypt = (
      service as unknown as { decryptField: (v: string) => string }
    ).decryptField.bind(service);

    const encrypted = encrypt('0123456789');
    expect(encrypted).not.toBe('0123456789');
    expect(encryptionService.isEncrypted(encrypted!)).toBe(true);
    expect(decrypt(encrypted!)).toBe('0123456789');
  });

  it('masks account numbers in display info', () => {
    const service = createService();
    const formatDisplayInfo = (
      service as unknown as { formatDisplayInfo: (m: PaymentMethod) => string }
    ).formatDisplayInfo.bind(service);

    const method = {
      bankName: 'GTBank',
      accountNumber: encryptionService.encrypt('0123456789'),
    } as PaymentMethod;

    expect(formatDisplayInfo(method)).toBe('GTBank - 6789');
  });
});

describe('PaymentMethodService verification', () => {
  it('rejects self-verification of a payment method', async () => {
    const memberId = 'member-self';
    const paymentMethodRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'pm-1',
        tenantId: 'tenant-1',
        memberId,
        status: PaymentMethodStatus.PENDING_VERIFICATION,
        currency: 'NGN',
        isPrimary: true,
      }),
    };
    const service = new PaymentMethodService(
      paymentMethodRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      new EncryptionService(),
      { log: jest.fn() } as never,
      {} as never,
      { getPayrollCurrencies: jest.fn(), requireIdentityForPayroll: jest.fn() } as never,
      { getTenant: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.verifyPaymentMethod(
        'pm-1',
        'tenant-1',
        { status: PaymentMethodStatus.VERIFIED },
        memberId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
