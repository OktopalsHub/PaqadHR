import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollRuns1781241346483 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payroll_runs (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        title VARCHAR(100) NOT NULL,
        frequency VARCHAR(20) NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        payment_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        base_currency VARCHAR(10) NOT NULL,
        total_gross_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_deductions DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_net_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        employee_count INT NOT NULL DEFAULT 0,
        tenant_id UUID NOT NULL,
        created_by UUID NOT NULL,
        processed_at TIMESTAMP,
        metadata JSON,
        idempotency_key VARCHAR(255),
        processing_locked_at TIMESTAMP,
        processing_locked_by UUID,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_payroll_runs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_payroll_runs_created_by FOREIGN KEY (created_by) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_payroll_runs_processing_locked_by FOREIGN KEY (processing_locked_by) REFERENCES tenant_members(id) ON DELETE SET NULL,
        CONSTRAINT uk_payroll_runs_tenant_period UNIQUE (tenant_id, period_start, period_end)
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_payroll_runs_idempotency_key ON payroll_runs(idempotency_key) WHERE idempotency_key IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE payroll_runs;`);
  }
}
