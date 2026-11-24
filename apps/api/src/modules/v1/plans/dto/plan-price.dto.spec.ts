import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdatePlanPriceDto } from './update-plan-price.dto';
import { UpsertPlanPriceDto } from './upsert-plan-price.dto';

const check = (cls: new () => object, plain: object) =>
  validate(plainToInstance(cls, plain), { whitelist: true, forbidNonWhitelisted: true });

const config = {
  pricePerUser: 5,
  minimumUsers: 1,
  includedUsers: 0,
  overagePricePerUser: 1,
  payrollFeePercentage: 2.5,
};

describe('UpdatePlanPriceDto', () => {
  it('accepts editable price fields', async () => {
    expect(
      await check(UpdatePlanPriceDto, { monthlyPrice: 10, isActive: true, regionalConfig: config }),
    ).toHaveLength(0);
  });

  it('rejects provider ids, ids and unknown fields', async () => {
    for (const bad of [
      { bachsProductId: 'x' },
      { nombaPlanId: 'x' },
      { id: 'x' },
      { planId: 'x' },
    ]) {
      expect((await check(UpdatePlanPriceDto, bad)).length).toBeGreaterThan(0);
    }
  });

  it('rejects wrong types and out-of-range values', async () => {
    expect((await check(UpdatePlanPriceDto, { monthlyPrice: '10' })).length).toBeGreaterThan(0);
    expect((await check(UpdatePlanPriceDto, { monthlyPrice: -1 })).length).toBeGreaterThan(0);
    expect(
      (
        await check(UpdatePlanPriceDto, {
          regionalConfig: { ...config, payrollFeePercentage: 101 },
        })
      ).length,
    ).toBeGreaterThan(0);
  });
});

describe('UpsertPlanPriceDto', () => {
  const valid = {
    slug: 'pro',
    name: 'Pro',
    countryCode: 'NG',
    currency: 'NGN',
    monthlyPrice: 100,
    regionalConfig: config,
  };

  it('accepts a valid body', async () => {
    expect(await check(UpsertPlanPriceDto, valid)).toHaveLength(0);
  });

  it('rejects unknown fields and bad currency', async () => {
    expect((await check(UpsertPlanPriceDto, { ...valid, id: 'x' })).length).toBeGreaterThan(0);
    expect(
      (await check(UpsertPlanPriceDto, { ...valid, currency: 'NAIRA' })).length,
    ).toBeGreaterThan(0);
  });
});
