import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Document1795450603399 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE document (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          name character varying(255) NOT NULL,
          type character varying(50) NOT NULL,
          file_key text NOT NULL,
          issue_date date,
          expiry_date date,
          description text,
          is_verified boolean DEFAULT false,
          tenant_member_id uuid NOT NULL,
          tenant_id uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          deleted_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY document
          ADD CONSTRAINT document_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY document
          ADD CONSTRAINT fk_document_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY document
          ADD CONSTRAINT fk_document_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "document";`);
  }
}
