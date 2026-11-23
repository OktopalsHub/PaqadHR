import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Address1795450564781 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE address (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          country character varying(50) NOT NULL,
          city character varying(50) NOT NULL,
          state character varying(50) NOT NULL,
          street character varying(50),
          postal_code character varying(12),
          tenant_member_id uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          deleted_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY address
          ADD CONSTRAINT address_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY address
          ADD CONSTRAINT fk_address_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "address";`);
  }
}
