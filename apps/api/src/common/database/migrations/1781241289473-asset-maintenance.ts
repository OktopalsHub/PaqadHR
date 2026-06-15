import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AssetMaintenance1781241289473 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE asset_maintenance (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        maintenance_date DATE NOT NULL,
        type VARCHAR(16) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'SCHEDULED',
        description TEXT NOT NULL,
        cost DECIMAL(10,2),
        performed_by VARCHAR(100),
        next_maintenance_date DATE,
        completion_date TIMESTAMP,
        notes TEXT,
        asset_id UUID NOT NULL,
        scheduled_by_id UUID NOT NULL,
        completed_by_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_asset_maintenance_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
        CONSTRAINT fk_asset_maintenance_scheduled_by FOREIGN KEY (scheduled_by_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_asset_maintenance_completed_by FOREIGN KEY (completed_by_id) REFERENCES tenant_members(id) ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE asset_maintenance;`);
  }
}
