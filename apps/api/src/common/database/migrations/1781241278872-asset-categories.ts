import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AssetCategories1781241278872 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE asset_categories (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        depreciation_rate DECIMAL(5,2),
        maintenance_frequency_months INTEGER,
        maintenance_description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        tenant_member_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_asset_categories_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_asset_categories_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE asset_categories;`);
  }
}
