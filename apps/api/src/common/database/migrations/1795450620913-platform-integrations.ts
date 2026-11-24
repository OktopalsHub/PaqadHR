import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformIntegrations1795450620913 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE platform_integrations (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          type character varying(16) NOT NULL,
          platform_team_id character varying NOT NULL,
          platform_team_name character varying NOT NULL,
          bot_token text,
          access_token text,
          refresh_token text,
          webhook_url character varying,
          is_active boolean DEFAULT true,
          expires_at timestamp without time zone,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY platform_integrations
          ADD CONSTRAINT platform_integrations_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY platform_integrations
          ADD CONSTRAINT fk_platform_integrations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_integrations";`);
  }
}
