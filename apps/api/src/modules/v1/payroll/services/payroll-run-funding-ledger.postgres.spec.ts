import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PayrollRunFundingLedger1792000000000 } from 'src/common/database/migrations/1792000000000-payroll-run-funding-ledger';

const integrationDatabaseUrl = process.env.PAYROLL_LEDGER_INTEGRATION_DATABASE_URL;
const integrationDescribe = integrationDatabaseUrl ? describe : describe.skip;

integrationDescribe('Payroll run funding ledger PostgreSQL integration', () => {
  let client: Client;
  let competingClient: Client;
  let schemaName: string;
  const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const payrollRunId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const migration = new PayrollRunFundingLedger1792000000000();

  beforeAll(async () => {
    if (!integrationDatabaseUrl) {
      throw new Error('PAYROLL_LEDGER_INTEGRATION_DATABASE_URL is required');
    }
    const databaseName = decodeURIComponent(new URL(integrationDatabaseUrl).pathname.slice(1));
    if (!databaseName.endsWith('_test')) {
      throw new Error(
        'Payroll ledger integration tests require a dedicated database whose name ends in _test',
      );
    }

    client = new Client({ connectionString: integrationDatabaseUrl });
    competingClient = new Client({ connectionString: integrationDatabaseUrl });
    await client.connect();
    await competingClient.connect();

    schemaName = `payroll_ledger_test_${randomUUID().replaceAll('-', '')}`;
    await client.query(`CREATE SCHEMA "${schemaName}"`);
    await client.query(`SET search_path TO "${schemaName}", public`);
    await competingClient.query(`SET search_path TO "${schemaName}", public`);

    // The production migration expects uuid_generate_v4(). Define it in this isolated
    // schema so the test does not need to install extensions or modify the shared database.
    await client.query(`
      CREATE FUNCTION uuid_generate_v4() RETURNS uuid
      LANGUAGE SQL VOLATILE AS $$ SELECT gen_random_uuid() $$;
      CREATE TABLE tenants (id uuid PRIMARY KEY);
      CREATE TABLE payroll_runs (
        id uuid PRIMARY KEY,
        tenant_id uuid NOT NULL
      );
    `);
    await client.query('INSERT INTO tenants (id) VALUES ($1)', [tenantId]);
    await client.query('INSERT INTO payroll_runs (id, tenant_id) VALUES ($1, $2)', [
      payrollRunId,
      tenantId,
    ]);

    await migration.up({
      query: async (sql: string) => {
        const result = await client.query(sql);
        if (sql.trimStart().startsWith('SELECT')) {
          return Array.isArray(result) ? (result[0]?.rows ?? []) : result.rows;
        }
        return [];
      },
    } as never);
  });

  afterAll(async () => {
    if (client && schemaName) {
      await client.query('SET search_path TO public');
      await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
    if (competingClient) await competingClient.end();
    if (client) await client.end();
  });

  it('enforces concurrent idempotency, positive amounts, restrictive foreign keys, and safe rollback', async () => {
    const insertFunding = (connection: Client) =>
      connection.query(
        `INSERT INTO payroll_run_funding_ledger
          (tenant_id, payroll_run_id, event_type, amount, currency, provider, provider_reference, idempotency_key)
         VALUES ($1, $2, 'funding_received', 10.00, 'NGN', 'BACHS', 'concurrent-checkout', 'funding:concurrent-checkout')`,
        [tenantId, payrollRunId],
      );

    const competingWrites = await Promise.allSettled([
      insertFunding(client),
      insertFunding(competingClient),
    ]);
    expect(competingWrites.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejectedWrites = competingWrites.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejectedWrites).toHaveLength(1);
    expect(rejectedWrites[0].reason).toMatchObject({ code: '23505' });

    const ledgerCount = await client.query(
      'SELECT COUNT(*)::int AS count FROM payroll_run_funding_ledger',
    );
    expect(ledgerCount.rows[0].count).toBe(1);

    await client.query(
      `INSERT INTO payroll_run_funding_ledger
        (tenant_id, payroll_run_id, event_type, amount, currency, provider, provider_reference, idempotency_key)
       VALUES ($1, $2, 'funding_received', 100.00, 'USD', 'BACHS', 'concurrent-reservation-funding', 'funding:concurrent-reservation-funding')`,
      [tenantId, payrollRunId],
    );

    // Exercise PostgreSQL's actual row-lock serialization used by approval/reservation
    // transactions: two different retry attempts each want 70 USD from the same 100 USD.
    const reserveUnderRunLock = async (connection: Client, reservationKey: string) => {
      await connection.query('BEGIN');
      try {
        await connection.query('SELECT id FROM payroll_runs WHERE id = $1 FOR UPDATE', [
          payrollRunId,
        ]);
        const balance = await connection.query(
          `SELECT
             COALESCE(SUM(amount) FILTER (WHERE event_type = 'funding_received'), 0)
             - COALESCE(SUM(amount) FILTER (WHERE event_type = 'payout_confirmed'), 0)
             - COALESCE(SUM(amount) FILTER (WHERE event_type = 'payout_reserved'), 0)
             + COALESCE(SUM(amount) FILTER (WHERE event_type = 'reservation_released'), 0)
             AS available
           FROM payroll_run_funding_ledger
           WHERE tenant_id = $1 AND payroll_run_id = $2 AND currency = 'USD'`,
          [tenantId, payrollRunId],
        );
        if (Number(balance.rows[0].available) < 70) {
          throw new Error('Insufficient verified run-scoped funds');
        }
        await connection.query(
          `INSERT INTO payroll_run_funding_ledger
            (tenant_id, payroll_run_id, event_type, amount, currency, provider, idempotency_key)
           VALUES ($1, $2, 'payout_reserved', 70.00, 'USD', 'BACHS', $3)`,
          [tenantId, payrollRunId, `reservation:${reservationKey}`],
        );
        await connection.query('COMMIT');
        return true;
      } catch (error) {
        await connection.query('ROLLBACK');
        throw error;
      }
    };

    const competingReservations = await Promise.allSettled([
      reserveUnderRunLock(client, 'concurrent-retry-a'),
      reserveUnderRunLock(competingClient, 'concurrent-retry-b'),
    ]);
    expect(competingReservations.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(competingReservations.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const reservationTotal = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM payroll_run_funding_ledger
       WHERE tenant_id = $1 AND payroll_run_id = $2
         AND currency = 'USD' AND event_type = 'payout_reserved'`,
      [tenantId, payrollRunId],
    );
    expect(Number(reservationTotal.rows[0].total)).toBe(70);

    await expect(
      client.query(
        `INSERT INTO payroll_run_funding_ledger
          (tenant_id, payroll_run_id, event_type, amount, currency, provider, provider_reference, idempotency_key)
         VALUES ($1, $2, 'funding_received', -1.00, 'NGN', 'BACHS', 'negative-amount', 'funding:negative-amount')`,
        [tenantId, payrollRunId],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    await expect(
      client.query(
        `INSERT INTO payroll_run_funding_ledger
          (tenant_id, payroll_run_id, event_type, amount, currency, provider, idempotency_key)
         VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', $1, 'funding_received', 1.00, 'NGN', 'BACHS', 'funding:missing-tenant')`,
        [payrollRunId],
      ),
    ).rejects.toMatchObject({ code: '23503' });

    await expect(
      client.query('DELETE FROM payroll_runs WHERE id = $1', [payrollRunId]),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(client.query('DELETE FROM tenants WHERE id = $1', [tenantId])).rejects.toMatchObject({
      code: '23503',
    });

    const queryRunner = {
      query: async (sql: string) => {
        const result = await client.query(sql);
        if (sql.trimStart().startsWith('SELECT')) {
          return Array.isArray(result) ? (result[0]?.rows ?? []) : result.rows;
        }
        return [];
      },
    };
    await expect(migration.down(queryRunner as never)).rejects.toThrow(
      'Refusing to drop payroll_run_funding_ledger because it contains financial audit records',
    );

    await client.query('DELETE FROM payroll_run_funding_ledger');
    await migration.down(queryRunner as never);
    const droppedTable = await client.query(
      `SELECT to_regclass($1) AS table_name`,
      [`"${schemaName}".payroll_run_funding_ledger`],
    );
    expect(droppedTable.rows[0].table_name).toBeNull();
  });
});
