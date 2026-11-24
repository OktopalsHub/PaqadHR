import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsService durability', () => {
  const original = process.env.NODE_ENV;
  beforeAll(() => {
    process.env.NODE_ENV = 'production';
  });
  afterAll(() => {
    process.env.NODE_ENV = original;
  });

  const entry = (n: number) =>
    ({ action: 'CREATE', description: `e${n}`, severity: 'LOW', status: 'SUCCESS' }) as never;

  function build(save: jest.Mock) {
    const repo = { create: jest.fn((v) => v), save };
    const service = new AuditLogsService(repo as never);
    return service as unknown as {
      queueAuditLog(e: unknown): Promise<void>;
      drainQueue(): Promise<void>;
      queue: unknown[];
    };
  }

  it('writes the entry before returning, leaving nothing in memory', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const service = build(save);
    await service.queueAuditLog(entry(1));
    expect(save).toHaveBeenCalledTimes(1);
    expect(service.queue).toHaveLength(0);
  });

  it('keeps an entry for retry when the write fails, and writes it on the next drain', async () => {
    const save = jest.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValue(undefined);
    const service = build(save);
    await service.queueAuditLog(entry(1));
    expect(service.queue).toHaveLength(1);
    await service.drainQueue();
    expect(service.queue).toHaveLength(0);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('drains everything queued during an outage in one pass, not 25 per tick', async () => {
    const save = jest.fn().mockRejectedValue(new Error('db down'));
    const service = build(save);
    for (let i = 0; i < 60; i++) await service.queueAuditLog(entry(i));
    expect(service.queue).toHaveLength(60);
    save.mockReset().mockResolvedValue(undefined);
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
