import { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollItems1781241349201 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payroll_items (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        payroll_run_id UUID NOT NULL,
        employee_id UUID NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        base_salary DECIMAL(15,2) NOT NULL,
        base_salary_currency VARCHAR(10) NOT NULL,
        gross_amount DECIMAL(15,2) NOT NULL,
        adjustments DECIMAL(15,2) NOT NULL DEFAULT 0,
        deductions DECIMAL(15,2) NOT NULL DEFAULT 0,
        net_amount DECIMAL(15,2) NOT NULL,
        payment_currency VARCHAR(10) NOT NULL,
        payment_amount DECIMAL(15,8) NOT NULL,
        exchange_rate DECIMAL(10,6) NOT NULL,
        payment_method_id UUID,
        description TEXT,
        transaction_id VARCHAR(100),
        payment_provider VARCHAR(50),
        paid_at TIMESTAMP,
        failure_reason TEXT,
        metadata JSON,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_payroll_items_run FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
        CONSTRAINT fk_payroll_items_employee FOREIGN KEY (employee_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_payroll_items_payment_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE payroll_items;`);
  }
}
