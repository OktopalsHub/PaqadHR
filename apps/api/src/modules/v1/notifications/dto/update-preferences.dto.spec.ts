import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { pickPreferenceFields } from '../services/notification-preference.service';
import { UpdatePreferencesDto } from './update-preference.dto';

const check = async (body: object) =>
  (await validate(plainToInstance(UpdatePreferencesDto, body), { whitelist: true, forbidNonWhitelisted: true })).length;

describe('bulk notification preferences', () => {
  it('accepts a valid list', async () => {
    expect(
      await check({ preferences: [{ notificationType: 'payroll', isEnabled: false }] }),
    ).toBe(0);
  });

  it('rejects ids, owners and unknown types smuggled into an item', async () => {
    expect(
      await check({
        preferences: [{ notificationType: 'payroll', tenantMemberId: 'someone-else', id: 'x' }],
      }),
    ).toBeGreaterThan(0);
    expect(await check({ preferences: [{ notificationType: 'nope' }] })).toBeGreaterThan(0);
  });

  it('caps the list size', async () => {
    const preferences = Array.from({ length: 51 }, () => ({ notificationType: 'payroll' }));
    expect(await check({ preferences })).toBeGreaterThan(0);
  });

  it('copies only the fields a member may change', () => {
    const picked = pickPreferenceFields({
      isEnabled: true,
      tenantMemberId: 'victim',
      id: 'row',
    } as never);
    expect(picked).toEqual({ isEnabled: true });
  });
});
