import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { DeletePaymentMethodDto } from './delete-payment-method.dto';
import { ReviewPaymentMethodDto } from './review-payment-method.dto';

const check = (cls: new () => object, plain: object) =>
  validate(plainToInstance(cls, plain), { whitelist: true, forbidNonWhitelisted: true });

describe('DeletePaymentMethodDto', () => {
  it('accepts an empty body or a 6-digit passcode', async () => {
    expect(await check(DeletePaymentMethodDto, {})).toHaveLength(0);
    expect(await check(DeletePaymentMethodDto, { passcode: '123456' })).toHaveLength(0);
  });

  it('rejects malformed passcodes, wrong types and unknown fields', async () => {
    for (const bad of [
      { passcode: '12345' },
      { passcode: 123456 },
      { passcode: '12345a' },
      { x: 1 },
    ]) {
      expect((await check(DeletePaymentMethodDto, bad)).length).toBeGreaterThan(0);
    }
  });
});

describe('ReviewPaymentMethodDto', () => {
  it('accepts review statuses', async () => {
    expect(await check(ReviewPaymentMethodDto, { status: 'verified', notes: 'ok' })).toHaveLength(
      0,
    );
  });

  it('rejects non-review statuses, long notes and unknown fields', async () => {
    for (const bad of [
      { status: 'draft' },
      { status: 'VERIFIED' },
      { status: 'verified', notes: 'a'.repeat(501) },
      { status: 'verified', extra: 1 },
      {},
    ]) {
      expect((await check(ReviewPaymentMethodDto, bad)).length).toBeGreaterThan(0);
    }
  });
});
