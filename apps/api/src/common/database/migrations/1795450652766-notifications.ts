import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Notifications1795450652766 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notifications (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          type character varying NOT NULL,
          channel character varying NOT NULL,
          priority character varying DEFAULT 'medium'::character varying NOT NULL,
          status character varying DEFAULT 'pending'::character varying NOT NULL,
          title character varying NOT NULL,
          message text NOT NULL,
          metadata jsonb,
          action_data jsonb,
          tenant_id uuid,
          recipient_id uuid,
          sent_at timestamp without time zone,
          delivered_at timestamp without time zone,
          read_at timestamp without time zone,
          expires_at timestamp without time zone,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY notifications
          ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_notifications_recipient_read ON notifications USING btree (recipient_id, read_at);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_notifications_tenant_recipient_status ON notifications USING btree (tenant_id, recipient_id, status);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_notifications_type_created ON notifications USING btree (type, created_at);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY notifications
          ADD CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY notifications
          ADD CONSTRAINT fk_notifications_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications";`);
  }
}
