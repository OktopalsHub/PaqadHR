import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentSecurity1795450663018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payment_security (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          member_id uuid NOT NULL,
          payment_passcode character varying(255) NOT NULL,
          passcode_attempts integer DEFAULT 0 NOT NULL,
          passcode_locked_until timestamp without time zone,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payment_security
          ADD CONSTRAINT payment_security_member_id_key UNIQUE (member_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payment_security
          ADD CONSTRAINT payment_security_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payment_security
          ADD CONSTRAINT fk_payment_security_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_security";`);
  }
}
