import { PublicTenantResponseDto } from './public-tenant-response.dto';

describe('PublicTenantResponseDto', () => {
  it('excludes sensitive workspace fields', () => {
    const tenant = {
      id: 'tenant-1',
      name: 'Acme',
      slug: 'acme',
      isActive: true,
      inviteCode: 'SECRET123',
      employeeCode: 'EMP',
      preferredCurrency: 'NGN',
      pricingLocked: true,
      industry: 'Tech',
      companySize: '11-50',
      location: 'Lagos',
      logoKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never;

    const response = PublicTenantResponseDto.toResponse(tenant);

    expect(response).toEqual({
      id: 'tenant-1',
      name: 'Acme',
      slug: 'acme',
      industry: 'Tech',
      companySize: '11-50',
      location: 'Lagos',
    });
    expect(response).not.toHaveProperty('inviteCode');
    expect(response).not.toHaveProperty('employeeCode');
    expect(response).not.toHaveProperty('preferredCurrency');
  });
});
