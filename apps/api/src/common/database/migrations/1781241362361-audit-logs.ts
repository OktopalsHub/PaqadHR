import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditLogs1781241362361 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        action VARCHAR(50) NOT NULL,
        resource_type VARCHAR(100),
        resource_id VARCHAR(255),
        description TEXT NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'LOW',
        status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
        tenant_id UUID,
        user_id UUID,
        ip_address INET,
        user_agent TEXT,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_audit_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
        CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_audit_logs_tenant_created_at ON audit_logs(tenant_id, created_at DESC);
      CREATE INDEX idx_audit_logs_action_created_at ON audit_logs(action, created_at DESC);
      CREATE INDEX idx_audit_logs_user_created_at ON audit_logs(user_id, created_at DESC);
      CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE audit_logs;`);
  }
}
