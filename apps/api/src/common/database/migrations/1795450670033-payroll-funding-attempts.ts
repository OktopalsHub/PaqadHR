import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollFundingAttempts1795450670033 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payroll_funding_attempts (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          tenant_id uuid NOT NULL,
          payroll_run_id uuid NOT NULL,
          purpose character varying(24) NOT NULL,
          attempt_number integer NOT NULL,
          provider character varying(24) NOT NULL,
          status character varying(24) NOT NULL,
          order_reference character varying(255) NOT NULL,
          idempotency_key character varying(255) NOT NULL,
          currency character varying(10) NOT NULL,
          amount numeric(30,12) NOT NULL,
          checkout_amount numeric(30,12),
          balance_applied numeric(30,12),
          selected_item_ids jsonb,
          provider_reference character varying(255),
          created_by_id uuid,
          confirmed_at timestamp without time zone,
          cancelled_at timestamp without time zone,
          expires_at timestamp without time zone,
          metadata jsonb,
          CONSTRAINT payroll_funding_attempts_amount_check CHECK ((amount > (0)::numeric)),
          CONSTRAINT payroll_funding_attempts_attempt_number_check CHECK ((attempt_number > 0)),
          CONSTRAINT payroll_funding_attempts_balance_applied_check CHECK (((balance_applied IS NULL) OR (balance_applied >= (0)::numeric))),
          CONSTRAINT payroll_funding_attempts_checkout_amount_check CHECK (((checkout_amount IS NULL) OR (checkout_amount >= (0)::numeric))),
          CONSTRAINT payroll_funding_attempts_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['run_funding'::character varying, 'retry_shortfall'::character varying])::text[]))),
          CONSTRAINT payroll_funding_attempts_status_check CHECK (((status)::text = ANY ((ARRAY['created'::character varying, 'pending'::character varying, 'processing'::character varying, 'confirmed'::character varying, 'reversed'::character varying, 'failed'::character varying, 'cancelled'::character varying, 'expired'::character varying, 'requires_review'::character varying])::text[])))
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_funding_attempts
          ADD CONSTRAINT payroll_funding_attempts_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_funding_attempts
          ADD CONSTRAINT uq_payroll_funding_attempt_idempotency UNIQUE (idempotency_key);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_funding_attempts
          ADD CONSTRAINT uq_payroll_funding_attempt_provider_ref UNIQUE (provider, order_reference);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_funding_attempts
          ADD CONSTRAINT uq_payroll_funding_attempt_run_number UNIQUE (payroll_run_id, purpose, attempt_number);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_payroll_funding_attempt_run_created ON payroll_funding_attempts USING btree (payroll_run_id, created_at);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_payroll_funding_attempt_tenant_status ON payroll_funding_attempts USING btree (tenant_id, status, created_at);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_payroll_funding_attempt_provider_reference ON payroll_funding_attempts USING btree (provider, provider_reference) WHERE (provider_reference IS NOT NULL);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_funding_attempts
          ADD CONSTRAINT payroll_funding_attempts_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_funding_attempts
          ADD CONSTRAINT payroll_funding_attempts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM payroll_funding_attempts',
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Refusing to drop payroll_funding_attempts because it contains financial audit records. ' +
          'Export or archive them and run an explicitly approved retention migration first.',
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_funding_attempts";`);
  }
}
