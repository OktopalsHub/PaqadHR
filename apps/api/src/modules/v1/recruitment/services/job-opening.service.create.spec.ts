import { JobOpeningService } from './job-opening.service';

describe('JobOpeningService.createJob', () => {
  it('persists the job opening instead of only building the entity', async () => {
    const built = { title: 'Engineer' };
    const repo = {
      create: jest.fn().mockReturnValue(built),
      save: jest.fn().mockResolvedValue({ ...built, id: 'job-1' }),
    };
    const service = new JobOpeningService(
      repo as never,
      {} as never,
      { queueActivity: jest.fn().mockResolvedValue(undefined) } as never,
      { capture: jest.fn() } as never,
    );

    const job = await service.createJob('tenant-1', 'member-1', {
      title: 'Engineer',
      position: 'Engineer',
    } as never);

    expect(repo.save).toHaveBeenCalledWith(built);
    expect(job.id).toBe('job-1');
  });

  it('rejects a department from another workspace', async () => {
    const repo = { create: jest.fn(), save: jest.fn() };
    const departments = { exists: jest.fn().mockResolvedValue(false) };
    const service = new JobOpeningService(
      repo as never,
      departments as never,
      { queueActivity: jest.fn() } as never,
      { capture: jest.fn() } as never,
    );
    await expect(
      service.createJob('tenant-1', 'member-1', { title: 'E', departmentId: 'foreign' } as never),
    ).rejects.toThrow('Department not found');
    expect(departments.exists).toHaveBeenCalledWith({
      where: { id: 'foreign', tenantId: 'tenant-1' },
    });
    expect(repo.save).not.toHaveBeenCalled();
  });
});
