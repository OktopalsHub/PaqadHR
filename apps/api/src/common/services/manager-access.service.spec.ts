import { IsNull } from 'typeorm';

import { ManagerAccessService } from './manager-access.service';

describe('ManagerAccessService open-employment scope', () => {
  const repository = {
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  };
  const service = new ManagerAccessService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it('resolves direct reports only from open employments', async () => {
    await service.getDirectReportIds('tenant-1', 'manager-1');
    expect(repository.find.mock.calls[0][0].where.endDate).toEqual(IsNull());
  });

  it('checks manager relationship only against open employments', async () => {
    await service.isManagerOf('tenant-1', 'manager-1', 'member-1');
    expect(repository.count.mock.calls[0][0].where.endDate).toEqual(IsNull());
  });
});
