import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CalendarEventReminderSent1781549462130 implements MigrationInterface {
  name = 'CalendarEventReminderSent1781549462130';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_calendar_events
        ADD COLUMN reminder_sent_at TIMESTAMPTZ;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_calendar_events
        DROP COLUMN IF EXISTS reminder_sent_at;
    `);
  }
}
