import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantMemberPositions1781241231969 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenant_member_positions (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_member_id UUID NOT NULL,
        position_id UUID NOT NULL,
        assigned_at TIMESTAMP,
        is_current BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_tenant_member_positions_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_tenant_member_positions_position FOREIGN KEY (position_id) REFERENCES position(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE tenant_member_positions;`);
  }
}
