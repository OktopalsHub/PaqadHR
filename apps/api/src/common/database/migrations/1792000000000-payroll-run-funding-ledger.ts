import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollRunFundingLedger1792000000000 implements MigrationInterface {
  name = 'PayrollRunFundingLedger1792000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payroll_run_funding_ledger (
        id uuid NOT NULL DEFAULT uuid_generate_v4(),
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        tenant_id uuid NOT NULL,
        payroll_run_id uuid NOT NULL,
        payroll_item_id uuid NULL,
        event_type varchar(32) NOT NULL,
        amount numeric(15, 2) NOT NULL CHECK (amount > 0),
        currency varchar(10) NOT NULL,
        provider varchar(32) NOT NULL,
        provider_reference varchar(255) NULL,
        idempotency_key varchar(255) NOT NULL,
        performed_by_id uuid NULL,
        approved_by_id uuid NULL,
        evidence jsonb NULL,
        CONSTRAINT pk_payroll_run_funding_ledger PRIMARY KEY (id),
        CONSTRAINT uk_payroll_run_funding_ledger_idempotency UNIQUE (idempotency_key),
        CONSTRAINT fk_payroll_run_funding_ledger_run
          FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE RESTRICT,
        CONSTRAINT fk_payroll_run_funding_ledger_tenant
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
        CONSTRAINT ck_payroll_run_funding_ledger_event_type
          CHECK (event_type IN ('funding_received', 'payout_reserved', 'payout_confirmed', 'reservation_released', 'shortfall_approved'))
      );
      CREATE INDEX ix_payroll_run_funding_ledger_run_created
        ON payroll_run_funding_ledger (payroll_run_id, created_at);
      CREATE INDEX ix_payroll_run_funding_ledger_tenant_run
        ON payroll_run_funding_ledger (tenant_id, payroll_run_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM payroll_run_funding_ledger',
    )) as Array<{ count: string }>;

    if (Number(count) > 0) {
      throw new Error(
        'Refusing to drop payroll_run_funding_ledger because it contains financial audit records. ' +
          'Export/archive the ledger and perform an explicitly approved retention migration first.',
      );
    }

    await queryRunner.query('DROP TABLE IF EXISTS payroll_run_funding_ledger');
  }
}
