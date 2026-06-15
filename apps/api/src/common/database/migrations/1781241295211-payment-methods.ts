import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentMethods1781241295211 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payment_methods (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        member_id UUID NOT NULL,
        type VARCHAR(10) NOT NULL DEFAULT 'bank',
        currency VARCHAR(10),
        bank_name VARCHAR(120),
        bank_code VARCHAR(20),
        account_name VARCHAR(160),
        account_number VARCHAR(60),
        country VARCHAR(2),
        is_primary BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'pending_verification',
        display_name VARCHAR(255),
        passcode_hash VARCHAR(255),
        passcode_set_at TIMESTAMP,
        last_passcode_change TIMESTAMP,
        failed_passcode_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        verified_at TIMESTAMP,
        verification_notes VARCHAR(500),
        last_used_at TIMESTAMP,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_payment_methods_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_payment_methods_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_payment_methods_tenant_member_primary ON payment_methods(tenant_id, member_id, is_primary);
      CREATE INDEX idx_payment_methods_tenant_currency_primary ON payment_methods(tenant_id, currency, is_primary);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE payment_methods;`);
  }
}
