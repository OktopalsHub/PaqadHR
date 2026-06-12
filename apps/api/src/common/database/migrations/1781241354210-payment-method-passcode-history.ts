import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentMethodPasscodeHistory1781241354210 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payment_method_passcode_history (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        payment_method_id UUID NOT NULL,
        member_id UUID NOT NULL,
        reason VARCHAR(50) NOT NULL,
        changed_at TIMESTAMP NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        changed_by_admin_id VARCHAR(255),
        notes VARCHAR(500),
        was_forced BOOLEAN NOT NULL DEFAULT false,
        metadata JSON,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_passcode_history_payment_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE CASCADE,
        CONSTRAINT fk_passcode_history_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_passcode_history_payment_method_changed ON payment_method_passcode_history(payment_method_id, changed_at);
      CREATE INDEX idx_passcode_history_member_changed ON payment_method_passcode_history(member_id, changed_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE payment_method_passcode_history;`);
  }
}
