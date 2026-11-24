import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { OnboardingRegionDto, SetTenantRegionDto } from './tenant-region.dto';

describe('tenant region DTOs', () => {
  it('normalises and accepts a real country', async () => {
    const dto = plainToInstance(SetTenantRegionDto, { countryCode: 'ng', preferredCurrency: 'ngn' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.countryCode).toBe('NG');
    expect(dto.preferredCurrency).toBe('NGN');
  });
  it('rejects junk', async () => {
    expect((await validate(plainToInstance(SetTenantRegionDto, { countryCode: 'Nigeria' }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(OnboardingRegionDto, { userSelectedCountry: '12' }))).length).toBeGreaterThan(0);
  });
});
