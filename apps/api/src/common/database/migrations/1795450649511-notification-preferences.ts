import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationPreferences1795450649511 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notification_preferences (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_member_id uuid NOT NULL,
          notification_type character varying NOT NULL,
          preferred_channel character varying NOT NULL,
          is_enabled boolean DEFAULT true NOT NULL,
          email_enabled boolean DEFAULT false NOT NULL,
          in_app_enabled boolean DEFAULT true NOT NULL,
          quiet_hours_start time without time zone,
          quiet_hours_end time without time zone,
          quiet_days text[] DEFAULT '{}'::text[] NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY notification_preferences
          ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_notification_preferences_tenant_member_type ON notification_preferences USING btree (tenant_member_id, notification_type);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY notification_preferences
          ADD CONSTRAINT fk_notification_preferences_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_preferences";`);
  }
}
