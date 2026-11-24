import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollRuns1795450666658 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payroll_runs (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          title character varying(100) NOT NULL,
          frequency character varying(20) NOT NULL,
          period_start date NOT NULL,
          period_end date NOT NULL,
          payment_date date NOT NULL,
          status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
          base_currency character varying(10) NOT NULL,
          total_gross_amount numeric(15,2) DEFAULT 0 NOT NULL,
          total_deductions numeric(15,2) DEFAULT 0 NOT NULL,
          total_net_amount numeric(15,2) DEFAULT 0 NOT NULL,
          employee_count integer DEFAULT 0 NOT NULL,
          tenant_id uuid NOT NULL,
          created_by uuid NOT NULL,
          processed_at timestamp without time zone,
          metadata json,
          idempotency_key character varying(255),
          processing_locked_at timestamp without time zone,
          processing_locked_by uuid,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
          payout_mode character varying(16)
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_runs
          ADD CONSTRAINT payroll_runs_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_runs
          ADD CONSTRAINT uk_payroll_runs_tenant_period_currency UNIQUE (tenant_id, period_start, period_end, base_currency);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_payroll_runs_idempotency_key ON payroll_runs USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_runs
          ADD CONSTRAINT fk_payroll_runs_created_by FOREIGN KEY (created_by) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_runs
          ADD CONSTRAINT fk_payroll_runs_processing_locked_by FOREIGN KEY (processing_locked_by) REFERENCES tenant_members(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_runs
          ADD CONSTRAINT fk_payroll_runs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_runs";`);
  }
}
