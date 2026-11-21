import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  InitializeTenantSettingsDto,
  InitializeTenantWorkspaceDto,
} from './initialize-tenant-settings.dto';

const errorsFor = async (cls: new () => object, body: object) =>
  validate(plainToInstance(cls, body), { whitelist: true, forbidNonWhitelisted: true });

describe('initialize tenant dtos', () => {
  it('accepts a valid body', async () => {
    expect(
      await errorsFor(InitializeTenantWorkspaceDto, {
        companyName: 'Acme',
        currency: 'USD',
        monthlyPointsAllowance: 100,
        initializeMemberPoints: true,
        initialPointsOverride: 50,
      }),
    ).toHaveLength(0);
  });

  it.each([
    { monthlyPointsAllowance: -5 },
    { monthlyPointsAllowance: '100; DROP' },
    { currency: 'DOLLARS' },
    { companyName: 42 },
    { enableNotifications: 'yes' },
    { tenantId: 'other-tenant' },
    { customSettings: { notAnArea: true } },
  ])('rejects %j', async (body) => {
    expect((await errorsFor(InitializeTenantSettingsDto, body)).length).toBeGreaterThan(0);
  });

  it('rejects an out-of-range initial points override', async () => {
    expect(
      (await errorsFor(InitializeTenantWorkspaceDto, { initialPointsOverride: 9_999_999 })).length,
    ).toBeGreaterThan(0);
  });
});
