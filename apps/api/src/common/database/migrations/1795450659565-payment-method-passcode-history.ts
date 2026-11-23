import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentMethodPasscodeHistory1795450659565 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payment_method_passcode_history (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          payment_method_id uuid NOT NULL,
          member_id uuid NOT NULL,
          reason character varying(50) NOT NULL,
          changed_at timestamp without time zone NOT NULL,
          ip_address character varying(45),
          user_agent text,
          changed_by_admin_id character varying(255),
          notes character varying(500),
          was_forced boolean DEFAULT false NOT NULL,
          metadata json,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payment_method_passcode_history
          ADD CONSTRAINT payment_method_passcode_history_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_passcode_history_member_changed ON payment_method_passcode_history USING btree (member_id, changed_at);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_passcode_history_payment_method_changed ON payment_method_passcode_history USING btree (payment_method_id, changed_at);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payment_method_passcode_history
          ADD CONSTRAINT fk_passcode_history_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payment_method_passcode_history
          ADD CONSTRAINT fk_passcode_history_payment_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_method_passcode_history";`);
  }
}
