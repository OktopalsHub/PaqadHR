import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditLogs1795450576280 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE audit_logs (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          action character varying(50) NOT NULL,
          resource_type character varying(100),
          resource_id character varying(255),
          description text NOT NULL,
          severity character varying(20) DEFAULT 'LOW'::character varying NOT NULL,
          status character varying(20) DEFAULT 'SUCCESS'::character varying NOT NULL,
          tenant_id uuid,
          user_id uuid,
          ip_address inet,
          user_agent text,
          metadata jsonb,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY audit_logs
          ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_audit_logs_action_created_at ON audit_logs USING btree (action, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_audit_logs_resource ON audit_logs USING btree (resource_type, resource_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_audit_logs_tenant_created_at ON audit_logs USING btree (tenant_id, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_audit_logs_user_created_at ON audit_logs USING btree (user_id, created_at DESC);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY audit_logs
          ADD CONSTRAINT fk_audit_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY audit_logs
          ADD CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs";`);
  }
}
