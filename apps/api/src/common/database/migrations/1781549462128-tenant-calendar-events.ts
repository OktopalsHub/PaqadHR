import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantCalendarEvents1781549462128 implements MigrationInterface {
  name = 'TenantCalendarEvents1781549462128';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenant_calendar_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'meeting',
        created_by UUID REFERENCES tenant_members(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_tenant_calendar_events_tenant_dates
        ON tenant_calendar_events(tenant_id, start_date, end_date);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE tenant_calendar_events;`);
  }
}
