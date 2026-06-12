import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformIntegrations1781241334797 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE platform_integrations (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        type VARCHAR(16) NOT NULL,
        platform_team_id VARCHAR NOT NULL,
        platform_team_name VARCHAR NOT NULL,
        bot_token TEXT,
        access_token TEXT,
        refresh_token TEXT,
        webhook_url VARCHAR,
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_platform_integrations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE platform_integrations;`);
  }
}
