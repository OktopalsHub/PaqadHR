import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ShoutoutMemberPoints1781241328785 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE shoutout_member_points (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        member_id UUID NOT NULL,
        total_earned INTEGER DEFAULT 0,
        total_given INTEGER DEFAULT 0,
        current_balance INTEGER DEFAULT 0,
        monthly_given INTEGER DEFAULT 0,
        monthly_received INTEGER DEFAULT 0,
        last_reset_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_shoutout_member_points_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_shoutout_member_points_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        UNIQUE (tenant_id, member_id)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_shoutout_member_points_tenant_id ON shoutout_member_points(tenant_id);
      CREATE INDEX idx_shoutout_member_points_member_id ON shoutout_member_points(member_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE shoutout_member_points;`);
  }
}
