import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsService queue', () => {
  const original = process.env.NODE_ENV;
  beforeAll(() => {
    process.env.NODE_ENV = 'production';
  });
  afterAll(() => {
    process.env.NODE_ENV = original;
  });

  const entry = (n: number) => ({ action: 'CREATE', description: `e${n}`, severity: 'LOW', status: 'SUCCESS' }) as never;

  function build(save: jest.Mock) {
    const repo = { create: jest.fn((v) => v), save };
    const service = new AuditLogsService(repo as never);
    return service as unknown as {
      queueAuditLog(e: unknown): Promise<void>;
      drainQueue(): Promise<void>;
      queue: unknown[];
    };
  }

  it('keeps a batch for retry when saving fails', async () => {
    const save = jest.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValue(undefined);
    const service = build(save);
    await service.queueAuditLog(entry(1));
    await service.drainQueue();
    expect(service.queue).toHaveLength(1);
    await service.drainQueue();
    expect(service.queue).toHaveLength(0);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('drains everything queued in one pass, not 25 per tick', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const service = build(save);
    for (let i = 0; i < 60; i++) await service.queueAuditLog(entry(i));
    await service.drainQueue();
    expect(service.queue).toHaveLength(0);
    expect(save).toHaveBeenCalledTimes(3);
  });

  it('gives up on an entry after repeated failures instead of retrying forever', async () => {
    const save = jest.fn().mockRejectedValue(new Error('poison'));
    const service = build(save);
    await service.queueAuditLog(entry(1));
    for (let i = 0; i < 6; i++) await service.drainQueue();
    expect(service.queue).toHaveLength(0);
  });
});
