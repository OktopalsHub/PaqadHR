import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Position1795450612002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "position" (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          title character varying(100) NOT NULL,
          department character varying(100),
          description text,
          is_active boolean DEFAULT true NOT NULL,
          tenant_id uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          color character varying(20),
          deleted_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY "position"
          ADD CONSTRAINT position_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY "position"
          ADD CONSTRAINT fk_position_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "position";`);
  }
}
