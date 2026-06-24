import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CalendarEventTimeReminder1781549462129 implements MigrationInterface {
  name = 'CalendarEventTimeReminder1781549462129';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_calendar_events
        ADD COLUMN all_day BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN start_time TIME,
        ADD COLUMN end_time TIME,
        ADD COLUMN reminder_minutes INTEGER;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_calendar_events
        DROP COLUMN IF EXISTS reminder_minutes,
        DROP COLUMN IF EXISTS end_time,
        DROP COLUMN IF EXISTS start_time,
        DROP COLUMN IF EXISTS all_day;
    `);
  }
}
