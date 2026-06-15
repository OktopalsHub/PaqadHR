import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserIntegrationTokens1781241343356 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_integration_tokens (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_member_id UUID NOT NULL,
        integration_id UUID NOT NULL,
        platform_type VARCHAR(16) NOT NULL,
        user_access_token TEXT NOT NULL,
        user_refresh_token TEXT,
        platform_user_id VARCHAR NOT NULL,
        platform_username VARCHAR NOT NULL,
        scopes JSON NOT NULL,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_user_integration_tokens_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_integration_tokens_integration FOREIGN KEY (integration_id) REFERENCES platform_integrations(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE user_integration_tokens;`);
  }
}
