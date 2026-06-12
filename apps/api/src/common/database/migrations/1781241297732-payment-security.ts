import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentSecurity1781241297732 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payment_security (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        member_id UUID NOT NULL UNIQUE,
        payment_passcode VARCHAR(255) NOT NULL,
        passcode_attempts INT NOT NULL DEFAULT 0,
        passcode_locked_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_payment_security_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE payment_security;`);
  }
}
