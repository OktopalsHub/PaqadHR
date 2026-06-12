import { MigrationInterface, QueryRunner } from 'typeorm';

export class Notifications1781241359849 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notifications (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        type VARCHAR NOT NULL,
        channel VARCHAR NOT NULL,
        priority VARCHAR NOT NULL DEFAULT 'medium',
        status VARCHAR NOT NULL DEFAULT 'pending',
        title VARCHAR NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB,
        action_data JSONB,
        tenant_id UUID,
        recipient_id UUID,
        email_template VARCHAR,
        email_context JSONB,
        email_subject VARCHAR,
        sent_at TIMESTAMP,
        delivered_at TIMESTAMP,
        read_at TIMESTAMP,
        expires_at TIMESTAMP,
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_notifications_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES tenant_members(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_notifications_tenant_recipient_status ON notifications(tenant_id, recipient_id, status);
      CREATE INDEX idx_notifications_type_created ON notifications(type, created_at);
      CREATE INDEX idx_notifications_recipient_read ON notifications(recipient_id, read_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE notifications;`);
  }
}
