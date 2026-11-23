import type { MigrationInterface, QueryRunner } from 'typeorm';

export class IntegrationChannels1795450623951 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE integration_channels (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          integration_id uuid NOT NULL,
          platform_channel_id character varying NOT NULL,
          platform_channel_name character varying NOT NULL,
          channel_type character varying(16) DEFAULT 'shoutouts'::character varying,
          is_primary boolean DEFAULT false,
          team_id uuid,
          department_id uuid,
          category_filter json,
          min_points_threshold integer DEFAULT 0,
          is_active boolean DEFAULT true,
          created_by uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY integration_channels
          ADD CONSTRAINT integration_channels_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY integration_channels
          ADD CONSTRAINT fk_integration_channels_integration FOREIGN KEY (integration_id) REFERENCES platform_integrations(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "integration_channels";`);
  }
}
