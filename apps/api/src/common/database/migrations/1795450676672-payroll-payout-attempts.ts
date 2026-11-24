import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollPayoutAttempts1795450676672 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payroll_payout_attempts (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          tenant_id uuid NOT NULL,
          payroll_run_id uuid NOT NULL,
          payroll_item_id uuid NOT NULL,
          attempt_number integer NOT NULL,
          provider character varying(24) NOT NULL,
          status character varying(24) NOT NULL,
          merchant_reference character varying(255),
          provider_reference character varying(255),
          idempotency_key character varying(255) NOT NULL,
          source_amount numeric(30,12),
          source_currency character varying(10),
          destination_amount numeric(30,12) NOT NULL,
          destination_currency character varying(10) NOT NULL,
          submitted_at timestamp without time zone,
          settled_at timestamp without time zone,
          metadata jsonb,
          CONSTRAINT payroll_payout_attempts_attempt_number_check CHECK ((attempt_number > 0)),
          CONSTRAINT payroll_payout_attempts_destination_amount_check CHECK ((destination_amount > (0)::numeric)),
          CONSTRAINT payroll_payout_attempts_source_amount_check CHECK (((source_amount IS NULL) OR (source_amount > (0)::numeric))),
          CONSTRAINT payroll_payout_attempts_status_check CHECK (((status)::text = ANY ((ARRAY['created'::character varying, 'processing'::character varying, 'payment_processed'::character varying, 'failed'::character varying, 'requires_review'::character varying, 'reversed'::character varying])::text[])))
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_payout_attempts
          ADD CONSTRAINT payroll_payout_attempts_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_payout_attempts
          ADD CONSTRAINT uq_payroll_payout_attempt_idempotency UNIQUE (idempotency_key);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_payout_attempts
          ADD CONSTRAINT uq_payroll_payout_attempt_item_provider_number UNIQUE (payroll_item_id, provider, attempt_number);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_payroll_payout_attempt_run_created ON payroll_payout_attempts USING btree (payroll_run_id, created_at);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_payroll_payout_attempt_tenant_status ON payroll_payout_attempts USING btree (tenant_id, status, created_at);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_payroll_payout_attempt_provider_merchant_ref ON payroll_payout_attempts USING btree (provider, merchant_reference) WHERE (merchant_reference IS NOT NULL);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_payroll_payout_attempt_provider_reference ON payroll_payout_attempts USING btree (provider, provider_reference) WHERE (provider_reference IS NOT NULL);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_payout_attempts
          ADD CONSTRAINT payroll_payout_attempts_payroll_item_id_fkey FOREIGN KEY (payroll_item_id) REFERENCES payroll_items(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_payout_attempts
          ADD CONSTRAINT payroll_payout_attempts_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_payout_attempts
          ADD CONSTRAINT payroll_payout_attempts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM payroll_payout_attempts',
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Refusing to drop payroll_payout_attempts because it contains financial audit records. ' +
          'Export or archive them and run an explicitly approved retention migration first.',
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_payout_attempts";`);
  }
}
