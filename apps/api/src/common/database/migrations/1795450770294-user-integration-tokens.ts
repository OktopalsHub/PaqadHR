import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserIntegrationTokens1795450770294 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_integration_tokens (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_member_id uuid NOT NULL,
          integration_id uuid NOT NULL,
          platform_type character varying(16) NOT NULL,
          user_access_token text NOT NULL,
          user_refresh_token text,
          platform_user_id character varying NOT NULL,
          platform_username character varying NOT NULL,
          scopes json NOT NULL,
          expires_at timestamp without time zone,
          is_active boolean DEFAULT true,
          last_used_at timestamp without time zone,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY user_integration_tokens
          ADD CONSTRAINT user_integration_tokens_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY user_integration_tokens
          ADD CONSTRAINT fk_user_integration_tokens_integration FOREIGN KEY (integration_id) REFERENCES platform_integrations(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY user_integration_tokens
          ADD CONSTRAINT fk_user_integration_tokens_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_integration_tokens";`);
  }
}
