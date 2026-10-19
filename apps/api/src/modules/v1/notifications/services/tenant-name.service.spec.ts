import { TenantNameService } from './tenant-name.service';

describe('TenantNameService', () => {
  const build = (tenant: { id: string; name: string } | null) => {
    const findOne = jest.fn().mockResolvedValue(tenant);
    const service = new TenantNameService({ findOne } as never);
    return { service, findOne };
  };

  it('resolves the workspace name', async () => {
    const { service } = build({ id: 'tenant-1', name: 'Acme Holdings' });

    await expect(service.resolve('tenant-1')).resolves.toBe('Acme Holdings');
  });

  it('returns null when the workspace has no name', async () => {
    const { service } = build({ id: 'tenant-1', name: '   ' });

    await expect(service.resolve('tenant-1')).resolves.toBeNull();
  });

  it('resolves each workspace only once for repeated payroll emails', async () => {
    const { service, findOne } = build({ id: 'tenant-1', name: 'Acme Holdings' });

    await service.resolve('tenant-1');
    await service.resolve('tenant-1');
    await service.resolve('tenant-1');

    // A payroll run emails every employee of the same workspace: one lookup, not one per member.
    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it('resolves a different workspace separately', async () => {
    const findOne = jest
      .fn()
      .mockResolvedValueOnce({ id: 'tenant-1', name: 'Acme Holdings' })
      .mockResolvedValueOnce({ id: 'tenant-2', name: 'Globex' });
    const service = new TenantNameService({ findOne } as never);

    await expect(service.resolve('tenant-1')).resolves.toBe('Acme Holdings');
    await expect(service.resolve('tenant-2')).resolves.toBe('Globex');
    expect(findOne).toHaveBeenCalledTimes(2);
  });
});
