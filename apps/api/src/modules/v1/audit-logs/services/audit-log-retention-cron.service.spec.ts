import { FindOperator } from 'typeorm';
import { AuditLogRetentionCronService } from './audit-log-retention-cron.service';

describe('AuditLogRetentionCronService', () => {
  it('purges stale logs in 500-id batches using LessThan cutoff', async () => {
    const batch1 = Array.from({ length: 500 }, (_, i) => ({ id: `a${i}` }));
    const batch2 = Array.from({ length: 500 }, (_, i) => ({ id: `b${i}` }));
    const find = jest
      .fn()
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2)
      .mockResolvedValueOnce([]);
    const deleteFn = jest.fn().mockResolvedValue(undefined);
    const service = new AuditLogRetentionCronService({
      find,
      delete: deleteFn,
    } as never);

    await service.purgeOldAuditLogs();

    expect(find).toHaveBeenCalledTimes(3);
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        select: ['id'],
        take: 500,
      }),
    );
    const cutoffOp = find.mock.calls[0][0].where.createdAt as FindOperator<Date>;
    expect(cutoffOp).toBeInstanceOf(FindOperator);
    expect(cutoffOp.type).toBe('lessThan');

    expect(deleteFn).toHaveBeenCalledTimes(2);
    expect(deleteFn).toHaveBeenCalledWith(batch1.map((log) => log.id));
    expect(deleteFn).toHaveBeenCalledWith(batch2.map((log) => log.id));
  });
});
