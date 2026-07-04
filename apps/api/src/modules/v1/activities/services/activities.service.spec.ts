import { ActivitiesService } from './activities.service';

describe('ActivitiesService', () => {
  beforeEach(() => {
    ActivitiesService.testLogs.length = 0;
  });

  it('queues activities in test mode without hitting the repository', async () => {
    const repo = { create: jest.fn(), save: jest.fn(), find: jest.fn() };
    const service = new ActivitiesService(repo as any);

    await service.queueActivity({
      tenantId: 'tenant-1',
      action: 'payroll.created',
      description: 'Payroll run created',
      resourceType: 'payroll',
      resourceId: 'run-1',
    });

    expect(ActivitiesService.testLogs).toHaveLength(1);
    expect(ActivitiesService.testLogs[0].tenantId).toBe('tenant-1');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('lists activities for a single tenant only', async () => {
    const items = [{ id: 'a1', tenantId: 'tenant-1' }];
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([items, 1]),
    };
    const repo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    const service = new ActivitiesService(repo as any);

    const result = await service.listForTenant('tenant-1', { page: 1, limit: 20 });

    expect(qb.where).toHaveBeenCalledWith('activity.tenant_id = :tenantId', {
      tenantId: 'tenant-1',
    });
    expect(result.items).toEqual(items);
    expect(result.total).toBe(1);
  });
});
