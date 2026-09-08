import { ForbiddenException } from '@nestjs/common';
import { PaymentMethodStatus } from '../../../../common/enums/payment-method-status.enum';
import { EncryptionService } from '../../../../common/services/encryption.service';
import type { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentMethodService } from './payment-method.service';
import { PmCreationService } from './pm-creation.service';

describe('PaymentMethodService encryption and masking', () => {
  const encryptionService = new EncryptionService();

  it('encrypts and decrypts bank fields round-trip via PmCreationService', () => {
    const creation = new PmCreationService(
      {} as never,
      encryptionService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const encrypted = creation.encryptField('0123456789');
    expect(encrypted).not.toBe('0123456789');
    expect(encryptionService.isEncrypted(encrypted!)).toBe(true);
    expect(creation.decryptField(encrypted!)).toBe('0123456789');
  });

  it('masks account numbers in display info', () => {
    const service = new PaymentMethodService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
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
    const pmVerificationService = {
      verifyPaymentMethod: jest
        .fn()
        .mockRejectedValue(new ForbiddenException('Cannot verify your own payment method')),
    };
    const service = new PaymentMethodService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      pmVerificationService as never,
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
