import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformUsers1781241340372 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE platform_users (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        integration_id UUID NOT NULL,
        tenant_member_id UUID,
        platform_user_id VARCHAR NOT NULL,
        platform_username VARCHAR NOT NULL,
        platform_display_name VARCHAR,
        platform_email VARCHAR,
        platform_avatar_url VARCHAR,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_platform_users_integration FOREIGN KEY (integration_id) REFERENCES platform_integrations(id) ON DELETE CASCADE,
        CONSTRAINT fk_platform_users_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE platform_users;`);
  }
}
