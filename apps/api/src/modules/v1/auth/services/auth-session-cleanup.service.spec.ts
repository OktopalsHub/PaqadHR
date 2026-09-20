import { AuthSessionCleanupService } from './auth-session-cleanup.service';

describe('AuthSessionCleanupService', () => {
  it('deletes expired sessions in batches until the final partial batch', async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce({ affected: 1000 })
      .mockResolvedValueOnce({ affected: 12 });
    const queryBuilder = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      execute,
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as never;

    const service = new AuthSessionCleanupService(repository);

    await service.cleanupExpiredSessions();

    expect(repository.createQueryBuilder).toHaveBeenCalledTimes(2);
    expect(queryBuilder.delete).toHaveBeenCalledTimes(2);
    expect(queryBuilder.from).toHaveBeenCalledWith(expect.anything());
    expect(queryBuilder.where).toHaveBeenCalledWith(expect.stringContaining('expires_at <= :now'));
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
