import type { QueryRunner } from 'typeorm';
import { BackfillExistingVerifiedUsers1787521285997 } from './1787521285997-backfill-existing-verified-users';

describe('BackfillExistingVerifiedUsers1787521285997', () => {
  it('backfills only users created before the migration transaction began', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const queryRunner = { query } as unknown as QueryRunner;
    const migration = new BackfillExistingVerifiedUsers1787521285997();

    await migration.up(queryRunner);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('SET email_verified = TRUE');
    expect(query.mock.calls[0][0]).toContain('WHERE email_verified = FALSE');
    expect(query.mock.calls[0][0]).toContain('created_at < CURRENT_TIMESTAMP');
    expect(query.mock.calls[0][0]).not.toContain('LOCK TABLE');
  });
});
