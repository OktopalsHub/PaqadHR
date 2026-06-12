import { MigrationInterface, QueryRunner } from 'typeorm';

export class IntegrationChannels1781241337624 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE integration_channels (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        integration_id UUID NOT NULL,
        platform_channel_id VARCHAR NOT NULL,
        platform_channel_name VARCHAR NOT NULL,
        channel_type VARCHAR(16) DEFAULT 'shoutouts',
        is_primary BOOLEAN DEFAULT false,
        team_id UUID,
        department_id UUID,
        category_filter JSON,
        min_points_threshold INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_integration_channels_integration FOREIGN KEY (integration_id) REFERENCES platform_integrations(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE integration_channels;`);
  }
}
