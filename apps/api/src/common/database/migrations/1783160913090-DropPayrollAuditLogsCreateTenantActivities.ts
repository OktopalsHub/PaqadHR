import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DropPayrollAuditLogsCreateTenantActivities1783160913090 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS payroll_audit_logs;`);

    await queryRunner.query(`
      CREATE TABLE tenant_activities (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        actor_member_id UUID,
        action VARCHAR(80) NOT NULL,
        resource_type VARCHAR(100),
        resource_id VARCHAR(255),
        description TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
        severity VARCHAR(20) NOT NULL DEFAULT 'LOW',
        ip_address VARCHAR(45),
        user_agent TEXT,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_tenant_activities_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_tenant_activities_actor_member FOREIGN KEY (actor_member_id) REFERENCES tenant_members(id) ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_tenant_activities_tenant_created_at
        ON tenant_activities(tenant_id, created_at DESC);
      CREATE INDEX idx_tenant_activities_tenant_resource
        ON tenant_activities(tenant_id, resource_type, resource_id);
      CREATE INDEX idx_tenant_activities_tenant_action
        ON tenant_activities(tenant_id, action);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_activities;`);

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
}
