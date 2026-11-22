import type { PaymentMethod } from '../entities/payment-method.entity';
import { maskAccountNumber, toPaymentMethodResponse } from './payment-method-response.util';

describe('toPaymentMethodResponse', () => {
  const method = {
    id: 'pm',
    accountName: 'enc-name',
    accountNumber: 'enc-number',
    passcodeHash: 'hash',
    failedPasscodeAttempts: 2,
    lockedUntil: null,
    bankName: 'Bank',
  } as unknown as PaymentMethod;
  const decrypt = (v: string | null) => (v === 'enc-name' ? 'Ada Obi' : '0123456789');

  it('masks the account number and drops passcode state', () => {
    const out = toPaymentMethodResponse(method, decrypt) as Record<string, unknown>;
    expect(out.accountNumber).toBe('******6789');
    expect(out.accountName).toBe('Ada Obi');
    expect(out).not.toHaveProperty('passcodeHash');
    expect(out).not.toHaveProperty('failedPasscodeAttempts');
    expect(out.bankName).toBe('Bank');
  });

  it('handles empty values', () => {
    expect(toPaymentMethodResponse(null, decrypt)).toBeNull();
    expect(maskAccountNumber(null)).toBeNull();
    expect(maskAccountNumber('123')).toBe('****');
  });
});
