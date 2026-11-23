import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EmergencyContact1795450608871 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE emergency_contact (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          full_name character varying(100) NOT NULL,
          phone_number character varying(20) NOT NULL,
          email character varying(100),
          relationship character varying(16) NOT NULL,
          address text,
          is_primary boolean DEFAULT false NOT NULL,
          tenant_member_id uuid NOT NULL,
          tenant_id uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY emergency_contact
          ADD CONSTRAINT emergency_contact_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY emergency_contact
          ADD CONSTRAINT fk_emergency_contact_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY emergency_contact
          ADD CONSTRAINT fk_emergency_contact_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "emergency_contact";`);
  }
}
