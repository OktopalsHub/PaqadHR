import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationPreferences1781241357044 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notification_preferences (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_member_id UUID NOT NULL,
        notification_type VARCHAR NOT NULL,
        preferred_channel VARCHAR NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        email_enabled BOOLEAN NOT NULL DEFAULT false,
        in_app_enabled BOOLEAN NOT NULL DEFAULT true,
        quiet_hours_start TIME,
        quiet_hours_end TIME,
        quiet_days TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_notification_preferences_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_notification_preferences_tenant_member_type ON notification_preferences(tenant_member_id, notification_type);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE notification_preferences;`);
  }
}
