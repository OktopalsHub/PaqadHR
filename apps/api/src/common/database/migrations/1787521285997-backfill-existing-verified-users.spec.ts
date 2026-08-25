import type { QueryRunner } from 'typeorm';
import { BackfillExistingVerifiedUsers1787521285997 } from './1787521285997-backfill-existing-verified-users';

describe('BackfillExistingVerifiedUsers1787521285997', () => {
  it('locks registrations before backfilling unverified legacy users', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const queryRunner = { query } as unknown as QueryRunner;
    const migration = new BackfillExistingVerifiedUsers1787521285997();

    await migration.up(queryRunner);

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toBe('LOCK TABLE "user" IN SHARE ROW EXCLUSIVE MODE;');
    expect(query.mock.calls[1][0]).toContain('SET email_verified = TRUE');
    expect(query.mock.calls[1][0]).toContain('WHERE email_verified = FALSE');
  });
});
