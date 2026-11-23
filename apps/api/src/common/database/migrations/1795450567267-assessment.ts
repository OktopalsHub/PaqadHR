import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Assessment1795450567267 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE assessment (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          type character varying NOT NULL,
          title character varying NOT NULL,
          description text NOT NULL,
          questions json NOT NULL,
          duration integer NOT NULL,
          passing_score integer NOT NULL,
          is_active boolean DEFAULT true NOT NULL,
          tenant_member_id uuid NOT NULL,
          tenant_id uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          deleted_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY assessment
          ADD CONSTRAINT assessment_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY assessment
          ADD CONSTRAINT fk_assessment_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY assessment
          ADD CONSTRAINT fk_assessment_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment";`);
  }
}
