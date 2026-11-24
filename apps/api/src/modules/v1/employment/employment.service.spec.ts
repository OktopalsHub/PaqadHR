import { NotFoundException } from '@nestjs/common';

import { EmploymentService } from './employment.service';
import type { Employment } from './entities/employment.entity';

const tenantId = 'tenant-1';
const memberId = 'member-1';

function build() {
  const employmentRepository = {
    createEmployment: jest.fn().mockResolvedValue({ id: 'employment-new' }),
    updateEmployment: jest.fn().mockResolvedValue({ id: 'employment-1' }),
    getEmployment: jest.fn().mockResolvedValue({ id: 'employment-1' }),
    replaceCurrentEmployment: jest.fn(),
  };
  const tenantMembersService = {
    getTenantMember: jest.fn().mockResolvedValue({ id: memberId }),
    memberExistsInTenant: jest.fn().mockResolvedValue(true),
  };
  const positionMemberService = { assignPosition: jest.fn().mockResolvedValue({}) };
  const positionService = { getPosition: jest.fn().mockResolvedValue({ id: 'position-1' }) };
  const activitiesService = { queueActivity: jest.fn().mockResolvedValue(undefined) };
  const tenantConfigService = { getPayrollCurrencies: jest.fn().mockResolvedValue(['USD']) };
  const tenantRepository = { findOne: jest.fn().mockResolvedValue({ id: tenantId }) };
  const service = new EmploymentService(
    employmentRepository as never,
    tenantRepository as never,
    tenantMembersService as never,
    positionMemberService as never,
    positionService as never,
    activitiesService as never,
    tenantConfigService as never,
  );
  return { service, employmentRepository, tenantMembersService, positionService };
}

const createDto = { startDate: new Date('2024-01-01'), payRate: 100 };

describe('EmploymentService referenced ids', () => {
  it('rejects a positionId from another tenant on create', async () => {
    const { service, employmentRepository, positionService } = build();
    positionService.getPosition.mockRejectedValue(new NotFoundException());

    await expect(
      service.createEmployment(tenantId, memberId, 'actor', {
        ...createDto,
        positionId: 'foreign',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(positionService.getPosition).toHaveBeenCalledWith('foreign', tenantId);
    expect(employmentRepository.createEmployment).not.toHaveBeenCalled();
  });

  it('rejects a reportsToId from another tenant on create', async () => {
    const { service, employmentRepository, tenantMembersService } = build();
    tenantMembersService.memberExistsInTenant.mockResolvedValue(false);

    await expect(
      service.createEmployment(tenantId, memberId, 'actor', {
        ...createDto,
        reportsToId: 'foreign',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tenantMembersService.memberExistsInTenant).toHaveBeenCalledWith(tenantId, 'foreign');
    expect(employmentRepository.createEmployment).not.toHaveBeenCalled();
  });

  it('rejects foreign reportsToId and positionId on update', async () => {
    const { service, employmentRepository, tenantMembersService, positionService } = build();
    tenantMembersService.memberExistsInTenant.mockResolvedValue(false);
    await expect(
      service.updateEmployment('employment-1', { reportsToId: 'foreign' }, tenantId),
    ).rejects.toBeInstanceOf(NotFoundException);

    tenantMembersService.memberExistsInTenant.mockResolvedValue(true);
    positionService.getPosition.mockRejectedValue(new NotFoundException());
    await expect(
      service.updateEmployment('employment-1', { positionId: 'foreign' }, tenantId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(employmentRepository.updateEmployment).not.toHaveBeenCalled();
  });
});

describe('EmploymentService.addCompensationRecord', () => {
  it('carries the reporting line, position and status onto the new row inside the replace call', async () => {
    const { service, employmentRepository } = build();
    const current = {
      id: 'old',
      startDate: new Date('2024-01-01'),
      currency: 'EUR',
      positionId: 'position-1',
      reportsToId: 'manager-1',
      status: 'on_leave',
    } as unknown as Employment;
    employmentRepository.replaceCurrentEmployment.mockImplementation(
      async (_t: string, _m: string, plan: (c: Employment | null) => unknown) => {
        employmentRepository.createEmployment.mock.calls.push([plan(current)]);
        return { id: 'employment-new' };
      },
    );

    await service.addCompensationRecord(tenantId, memberId, 'actor', {
      effectiveDate: new Date('2024-06-01'),
      payRate: 200,
      payType: 'salary',
      paySchedule: 'monthly',
    } as never);

    const [plan] = employmentRepository.createEmployment.mock.calls[0] as [
      { endDate: Date; next: Partial<Employment> },
    ];
    expect(plan.endDate).toEqual(new Date('2024-05-31'));
    expect(plan.next).toMatchObject({
      reportsToId: 'manager-1',
      positionId: 'position-1',
      status: 'on_leave',
      currency: 'EUR',
      payRate: 200,
      tenantMemberId: memberId,
      tenantId,
    });
  });
});
