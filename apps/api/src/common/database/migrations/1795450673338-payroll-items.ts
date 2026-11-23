import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollItems1795450673338 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payroll_items (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          payroll_run_id uuid NOT NULL,
          employee_id uuid NOT NULL,
          status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
          base_salary numeric(15,2) NOT NULL,
          base_salary_currency character varying(10) NOT NULL,
          gross_amount numeric(15,2) NOT NULL,
          adjustments numeric(15,2) DEFAULT 0 NOT NULL,
          deductions numeric(15,2) DEFAULT 0 NOT NULL,
          net_amount numeric(15,2) NOT NULL,
          payment_currency character varying(10) NOT NULL,
          payment_amount numeric(15,8) NOT NULL,
          exchange_rate numeric(18,12) NOT NULL,
          payment_method_id uuid,
          description text,
          transaction_id character varying(100),
          payment_provider character varying(50),
          paid_at timestamp without time zone,
          failure_reason text,
          metadata json,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_items
          ADD CONSTRAINT payroll_items_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_items
          ADD CONSTRAINT fk_payroll_items_employee FOREIGN KEY (employee_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_items
          ADD CONSTRAINT fk_payroll_items_payment_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payroll_items
          ADD CONSTRAINT fk_payroll_items_run FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_items";`);
  }
}
