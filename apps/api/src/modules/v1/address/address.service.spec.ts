import { NotFoundException } from '@nestjs/common';

import { AddressService } from './address.service';

describe('AddressService tenant scope', () => {
  const setup = (membersInTenant: unknown[] = []) => {
    const addressRepository = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ id: 'a1', ...v })),
      listAddresses: jest.fn().mockResolvedValue([{ id: 'a1' }]),
      findAddress: jest.fn().mockResolvedValue({ id: 'a1' }),
      findOne: jest.fn().mockResolvedValue({ id: 'a1' }),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const activitiesService = { queueActivity: jest.fn().mockResolvedValue(undefined) };
    const tenantMembersService = {
      getTenantMembersByIds: jest.fn().mockResolvedValue(membersInTenant),
    };
    const service = new AddressService(
      addressRepository as never,
      activitiesService as never,
      tenantMembersService as never,
    );
    return { service, addressRepository, tenantMembersService };
  };

  const dto = { city: 'Lagos', country: 'NG' } as never;

  it.each([
    ['listAddresses', (s: AddressService) => s.listAddresses('tA', 'mB')],
    ['getPrimaryAddress', (s: AddressService) => s.getPrimaryAddress('tA', 'mB')],
    ['createAddress', (s: AddressService) => s.createAddress('tA', 'mB', dto)],
    ['upsertMemberAddress', (s: AddressService) => s.upsertMemberAddress('tA', 'mB', dto)],
    ['updateAddress', (s: AddressService) => s.updateAddress('tA', 'mB', 'a1', {} as never)],
    ['deleteAddress', (s: AddressService) => s.deleteAddress('tA', 'mB', 'a1')],
    ['getAddress', (s: AddressService) => s.getAddress('tA', 'mB', 'a1')],
  ])('%s rejects a member outside the tenant before touching addresses', async (_n, call) => {
    const { service, addressRepository, tenantMembersService } = setup([]);

    await expect(call(service)).rejects.toBeInstanceOf(NotFoundException);

    expect(tenantMembersService.getTenantMembersByIds).toHaveBeenCalledWith('tA', ['mB']);
    for (const fn of Object.values(addressRepository)) expect(fn).not.toHaveBeenCalled();
  });

  it('lists addresses when the member belongs to the tenant', async () => {
    const { service } = setup([{ id: 'mB' }]);

    await expect(service.listAddresses('tA', 'mB')).resolves.toEqual([{ id: 'a1' }]);
  });
});
