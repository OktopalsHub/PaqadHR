import { NotFoundException } from '@nestjs/common';

import { DepartmentCrudService } from './department-crud.service';

function build() {
  const departmentsRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation(async (row: unknown) => row),
    create: jest.fn().mockImplementation((row: unknown) => row),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const tenantMembersService = { memberExistsInTenant: jest.fn().mockResolvedValue(true) };
  const service = new DepartmentCrudService(
    departmentsRepository as never,
    { queueActivity: jest.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    tenantMembersService as never,
  );
  return { service, departmentsRepository, tenantMembersService };
}

describe('DepartmentCrudService referenced ids', () => {
  it('rejects a managerId outside the tenant on create', async () => {
    const { service, departmentsRepository, tenantMembersService } = build();
    tenantMembersService.memberExistsInTenant.mockResolvedValue(false);

    await expect(
      service.createDepartment('tenant-1', 'actor', { name: 'Ops', managerId: 'foreign' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(departmentsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a parentId outside the tenant on create', async () => {
    const { service, departmentsRepository } = build();

    await expect(
      service.createDepartment('tenant-1', 'actor', { name: 'Ops', parentId: 'foreign' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(departmentsRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'foreign', tenantId: 'tenant-1' },
      select: { id: true },
    });
    expect(departmentsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a parentId outside the tenant on update', async () => {
    const { service, departmentsRepository } = build();
    departmentsRepository.findOne.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        where.id === 'dept-1' ? { id: 'dept-1' } : null,
    );

    await expect(
      service.updateDepartment('tenant-1', 'dept-1', { parentId: 'foreign' }, 'actor'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(departmentsRepository.update).not.toHaveBeenCalled();
  });
});
