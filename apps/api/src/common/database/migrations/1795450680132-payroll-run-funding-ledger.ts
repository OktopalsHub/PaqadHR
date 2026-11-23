import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollRunFundingLedger1795450680132 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payroll_run_funding_ledger (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          tenant_id uuid NOT NULL,
          payroll_run_id uuid NOT NULL,
          payroll_item_id uuid,
          event_type character varying(32) NOT NULL,
          amount numeric(15,2) NOT NULL,
          currency character varying(10) NOT NULL,
          provider character varying(32) NOT NULL,
          provider_reference character varying(255),
          idempotency_key character varying(255) NOT NULL,
          performed_by_id uuid,
          approved_by_id uuid,
          evidence jsonb,
          CONSTRAINT ck_payroll_run_funding_ledger_amount CHECK ((amount >= (0)::numeric)),
          CONSTRAINT ck_payroll_run_funding_ledger_event_type CHECK (((event_type)::text = ANY ((ARRAY['funding_received'::character varying, 'payout_reserved'::character varying, 'payout_confirmed'::character varying, 'payout_reversed'::character varying, 'reservation_released'::character varying, 'shortfall_approved'::character varying, 'shortfall_cancelled'::character varying])::text[])))
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_run_funding_ledger
          ADD CONSTRAINT pk_payroll_run_funding_ledger PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_run_funding_ledger
          ADD CONSTRAINT uk_payroll_run_funding_ledger_idempotency UNIQUE (idempotency_key);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_payroll_run_funding_ledger_run_created ON payroll_run_funding_ledger USING btree (payroll_run_id, created_at);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_payroll_run_funding_ledger_tenant_run ON payroll_run_funding_ledger USING btree (tenant_id, payroll_run_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_run_funding_ledger
          ADD CONSTRAINT fk_payroll_run_funding_ledger_run FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_run_funding_ledger
          ADD CONSTRAINT fk_payroll_run_funding_ledger_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM payroll_run_funding_ledger',
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Refusing to drop payroll_run_funding_ledger because it contains financial audit records. ' +
          'Export or archive them and run an explicitly approved retention migration first.',
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_run_funding_ledger";`);
  }
}
