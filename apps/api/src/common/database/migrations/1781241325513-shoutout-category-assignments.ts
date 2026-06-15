import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ShoutoutCategoryAssignments1781241325513 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE shoutout_category_assignments (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        shoutout_id UUID NOT NULL,
        category_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_shoutout_category_assignments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_shoutout_category_assignments_shoutout FOREIGN KEY (shoutout_id) REFERENCES shoutouts(id) ON DELETE CASCADE,
        CONSTRAINT fk_shoutout_category_assignments_category FOREIGN KEY (category_id) REFERENCES shoutout_categories(id) ON DELETE CASCADE,
        CONSTRAINT uq_shoutout_category UNIQUE (shoutout_id, category_id)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE shoutout_category_assignments;`);
  }
}
