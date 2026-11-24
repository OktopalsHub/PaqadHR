import { ActivitiesService } from './activities.service';

describe('ActivitiesService durability', () => {
  const original = process.env.NODE_ENV;
  beforeAll(() => {
    process.env.NODE_ENV = 'production';
  });
  afterAll(() => {
    process.env.NODE_ENV = original;
  });

  const entry = { tenantId: 't', actorMemberId: 'm', action: 'CREATE', description: 'x' } as never;

  function build(save: jest.Mock) {
    const repo = { create: jest.fn((v) => v), save };
    const service = new ActivitiesService(repo as never, {} as never);
    return service as unknown as {
      queueActivity(e: unknown): Promise<void>;
      drainQueue(): Promise<void>;
      queue: unknown[];
    };
  }

  it('writes before returning and keeps nothing in memory', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const service = build(save);
    await service.queueActivity(entry);
    expect(save).toHaveBeenCalledTimes(1);
    expect(service.queue).toHaveLength(0);
  });

  it('queues for retry when the write fails, then writes on the next drain', async () => {
    const save = jest.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValue(undefined);
    const service = build(save);
    await service.queueActivity(entry);
    expect(service.queue).toHaveLength(1);
    await service.drainQueue();
    expect(service.queue).toHaveLength(0);
  });
});
