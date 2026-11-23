import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantCalendarEvents1795450763765 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenant_calendar_events (
          id uuid DEFAULT gen_random_uuid() NOT NULL,
          tenant_id uuid NOT NULL,
          title character varying(200) NOT NULL,
          description text,
          start_date date NOT NULL,
          end_date date NOT NULL,
          type character varying(50) DEFAULT 'meeting'::character varying NOT NULL,
          created_by uuid,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          all_day boolean DEFAULT true NOT NULL,
          start_time time without time zone,
          end_time time without time zone,
          reminder_minutes integer,
          reminder_sent_at timestamp with time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_calendar_events
          ADD CONSTRAINT tenant_calendar_events_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_tenant_calendar_events_tenant_dates ON tenant_calendar_events USING btree (tenant_id, start_date, end_date);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_calendar_events
          ADD CONSTRAINT tenant_calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES tenant_members(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_calendar_events
          ADD CONSTRAINT tenant_calendar_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_calendar_events";`);
  }
}
