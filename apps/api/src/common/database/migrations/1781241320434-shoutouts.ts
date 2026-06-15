import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Shoutouts1781241320434 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE shoutouts (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        total_points INT DEFAULT 0,
        created_by UUID NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_shoutouts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_shoutouts_created_by FOREIGN KEY (created_by) REFERENCES tenant_members(id) ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_shoutouts_tenant_id ON shoutouts(tenant_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE shoutouts;`);
  }
}
