import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollAuditLogs1781241351647 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payroll_audit_logs (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        payroll_run_id UUID,
        member_id UUID,
        performed_by UUID,
        event_type VARCHAR(50) NOT NULL,
        description VARCHAR(200) NOT NULL,
        before_data JSON,
        after_data JSON,
        ip_address VARCHAR(45),
        user_agent VARCHAR(500),
        session_id VARCHAR(100),
        metadata JSON,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_payroll_audit_logs_run FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
        CONSTRAINT fk_payroll_audit_logs_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE SET NULL,
        CONSTRAINT fk_payroll_audit_logs_performed_by FOREIGN KEY (performed_by) REFERENCES tenant_members(id) ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE payroll_audit_logs;`);
  }
}
