import { MigrationInterface, QueryRunner } from 'typeorm';

export class Assets1781241281751 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE assets (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        type VARCHAR(16) NOT NULL,
        serial_number VARCHAR(100),
        model VARCHAR(100),
        manufacturer VARCHAR(100),
        purchase_date DATE NOT NULL,
        purchase_price DECIMAL(10,2) NOT NULL,
        warranty_expiry DATE,
        status VARCHAR(16) NOT NULL DEFAULT 'AVAILABLE',
        condition VARCHAR(16) NOT NULL DEFAULT 'NEW',
        building VARCHAR(100),
        floor VARCHAR(100),
        room VARCHAR(100),
        location_notes TEXT,
        notes TEXT,
        category_id UUID NOT NULL,
        tenant_member_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        created_by UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_assets_category FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE CASCADE,
        CONSTRAINT fk_assets_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_assets_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_assets_created_by FOREIGN KEY (created_by) REFERENCES tenant_members(id) ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE assets;`);
  }
}
