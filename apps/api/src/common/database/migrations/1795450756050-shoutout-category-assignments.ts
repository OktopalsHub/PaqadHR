import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ShoutoutCategoryAssignments1795450756050 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE shoutout_category_assignments (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          shoutout_id uuid NOT NULL,
          category_id uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutout_category_assignments
          ADD CONSTRAINT shoutout_category_assignments_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutout_category_assignments
          ADD CONSTRAINT uq_shoutout_category UNIQUE (shoutout_id, category_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutout_category_assignments
          ADD CONSTRAINT fk_shoutout_category_assignments_category FOREIGN KEY (category_id) REFERENCES shoutout_categories(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutout_category_assignments
          ADD CONSTRAINT fk_shoutout_category_assignments_shoutout FOREIGN KEY (shoutout_id) REFERENCES shoutouts(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutout_category_assignments
          ADD CONSTRAINT fk_shoutout_category_assignments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "shoutout_category_assignments";`);
  }
}
