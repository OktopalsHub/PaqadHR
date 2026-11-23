import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformUsers1795450696352 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE platform_users (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          integration_id uuid NOT NULL,
          tenant_member_id uuid,
          platform_user_id character varying NOT NULL,
          platform_username character varying NOT NULL,
          platform_display_name character varying,
          platform_email character varying,
          platform_avatar_url character varying,
          is_active boolean DEFAULT true,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY platform_users
          ADD CONSTRAINT platform_users_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY platform_users
          ADD CONSTRAINT fk_platform_users_integration FOREIGN KEY (integration_id) REFERENCES platform_integrations(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY platform_users
          ADD CONSTRAINT fk_platform_users_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_users";`);
  }
}
