import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Education1795450606096 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE education (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          title character varying(255) NOT NULL,
          degree_type character varying(20) NOT NULL,
          institution character varying(255) NOT NULL,
          field_of_study character varying(100),
          start_date date,
          end_date date,
          description text,
          gpa character varying(10),
          tenant_member_id uuid NOT NULL,
          tenant_id uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY education
          ADD CONSTRAINT education_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY education
          ADD CONSTRAINT fk_education_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY education
          ADD CONSTRAINT fk_education_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "education";`);
  }
}
