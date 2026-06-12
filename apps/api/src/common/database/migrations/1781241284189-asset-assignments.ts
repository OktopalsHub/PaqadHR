import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssetAssignments1781241284189 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE asset_assignments (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        assigned_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        return_date TIMESTAMP,
        expected_return_date TIMESTAMP,
        status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
        assignment_notes TEXT,
        return_notes TEXT,
        return_condition VARCHAR(100),
        asset_id UUID NOT NULL,
        assigned_to_id UUID NOT NULL,
        assigned_by_id UUID NOT NULL,
        returned_by_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_asset_assignments_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
        CONSTRAINT fk_asset_assignments_assigned_to FOREIGN KEY (assigned_to_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_asset_assignments_assigned_by FOREIGN KEY (assigned_by_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_asset_assignments_returned_by FOREIGN KEY (returned_by_id) REFERENCES tenant_members(id) ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE asset_assignments;`);
  }
}
