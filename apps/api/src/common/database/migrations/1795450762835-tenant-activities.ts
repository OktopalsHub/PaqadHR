import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantActivities1795450762835 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenant_activities (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          actor_member_id uuid,
          action character varying(80) NOT NULL,
          resource_type character varying(100),
          resource_id character varying(255),
          description text NOT NULL,
          status character varying(20) DEFAULT 'SUCCESS'::character varying NOT NULL,
          severity character varying(20) DEFAULT 'LOW'::character varying NOT NULL,
          ip_address character varying(45),
          user_agent text,
          metadata jsonb,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_activities
          ADD CONSTRAINT tenant_activities_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_tenant_activities_tenant_action ON tenant_activities USING btree (tenant_id, action);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_tenant_activities_tenant_created_at ON tenant_activities USING btree (tenant_id, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_tenant_activities_tenant_resource ON tenant_activities USING btree (tenant_id, resource_type, resource_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_activities
          ADD CONSTRAINT fk_tenant_activities_actor_member FOREIGN KEY (actor_member_id) REFERENCES tenant_members(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_activities
          ADD CONSTRAINT fk_tenant_activities_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_activities";`);
  }
}
