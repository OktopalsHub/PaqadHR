import { BadRequestException } from '@nestjs/common';

import { AttendanceService } from './attendance.service';

const TENANT_ID = 'tenant-1';

const buildService = (foundMemberIds: string[]) => {
  const repo = { insert: jest.fn().mockResolvedValue({ identifiers: [] }) };
  const members = {
    findByIdsAndTenantId: jest.fn().mockResolvedValue(foundMemberIds.map((id) => ({ id }))),
  };
  const service = new AttendanceService(
    repo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    members as never,
  );
  return { service, repo, members };
};

const record = (memberId: string) => ({ memberId, date: '2026-01-05', status: 'PRESENT' });

describe('AttendanceService.bulkCreateAttendance', () => {
  it('rejects the whole batch when any member is outside the tenant', async () => {
    const { service, repo } = buildService(['m1']);

    await expect(
      service.bulkCreateAttendance(TENANT_ID, [record('m1'), record('foreign')]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('looks members up inside the tenant and inserts when all belong', async () => {
    const { service, repo, members } = buildService(['m1', 'm2']);

    await service.bulkCreateAttendance(TENANT_ID, [record('m1'), record('m2'), record('m1')]);

    expect(members.findByIdsAndTenantId).toHaveBeenCalledWith(TENANT_ID, ['m1', 'm2']);
    expect(repo.insert).toHaveBeenCalledTimes(1);
  });
});
