import type { DataSource } from 'typeorm';

import { CronClaimService } from './cron-claim.service';

const createHarness = (locked: boolean) => {
  const queryRunner = {
    connect: jest.fn(),
    release: jest.fn(),
    query: jest.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('pg_try_advisory_lock')) return [{ locked }];
      return [];
    }),
  };
  const dataSource = {
    createQueryRunner: jest.fn().mockReturnValue(queryRunner),
  } as unknown as DataSource;
  return { service: new CronClaimService(dataSource), queryRunner };
};

describe('CronClaimService', () => {
  it('runs the job and releases the lock when the claim is acquired', async () => {
    const { service, queryRunner } = createHarness(true);
    const job = jest.fn().mockResolvedValue({ checked: 1 });

    await expect(service.runExclusive('payroll-payout-requery', job)).resolves.toEqual({
      checked: 1,
    });

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      'SELECT pg_advisory_unlock(hashtext($1))',
      ['cron:payroll-payout-requery'],
    );
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('skips the job when another instance already holds the claim', async () => {
    const { service, queryRunner } = createHarness(false);
    const job = jest.fn();

    await expect(service.runExclusive('payroll-scheduled-payouts', job)).resolves.toBeUndefined();

    expect(job).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('does not stack a second tick of the same job while the first is in flight', async () => {
    const { service } = createHarness(true);
    let releaseJob: (() => void) | undefined;
    const job = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          releaseJob = () => resolve('done');
        }),
    );

    const first = service.runExclusive('payroll-retry-funding-expiry', job);
    await new Promise((resolve) => setImmediate(resolve));
    const second = await service.runExclusive('payroll-retry-funding-expiry', job);

    expect(second).toBeUndefined();
    expect(job).toHaveBeenCalledTimes(1);

    releaseJob?.();
    await expect(first).resolves.toBe('done');
  });
});
