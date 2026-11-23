import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentMethods1795450656265 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payment_methods (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          member_id uuid NOT NULL,
          type character varying(10) DEFAULT 'bank'::character varying NOT NULL,
          currency character varying(10),
          bank_name character varying(120),
          bank_code character varying(20),
          account_name character varying(512),
          account_number character varying(512),
          country character varying(2),
          is_primary boolean DEFAULT false,
          status character varying(50) DEFAULT 'pending_verification'::character varying,
          display_name character varying(255),
          passcode_hash character varying(255),
          passcode_set_at timestamp without time zone,
          last_passcode_change timestamp without time zone,
          failed_passcode_attempts integer DEFAULT 0,
          locked_until timestamp without time zone,
          verified_at timestamp without time zone,
          verification_notes character varying(500),
          last_used_at timestamp without time zone,
          metadata json,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          submitted_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payment_methods
          ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_payment_methods_tenant_currency_primary ON payment_methods USING btree (tenant_id, currency, is_primary);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_payment_methods_tenant_member_primary ON payment_methods USING btree (tenant_id, member_id, is_primary);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_payment_methods_owner_reference ON payment_methods USING btree (id, tenant_id, member_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payment_methods
          ADD CONSTRAINT fk_payment_methods_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY payment_methods
          ADD CONSTRAINT fk_payment_methods_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_methods";`);
  }
}
