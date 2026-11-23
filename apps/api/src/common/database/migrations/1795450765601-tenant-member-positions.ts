import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantMemberPositions1795450765601 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenant_member_positions (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_member_id uuid NOT NULL,
          position_id uuid NOT NULL,
          assigned_at timestamp without time zone,
          is_current boolean DEFAULT false NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_member_positions
          ADD CONSTRAINT tenant_member_positions_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_member_positions
          ADD CONSTRAINT fk_tenant_member_positions_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_member_positions
          ADD CONSTRAINT fk_tenant_member_positions_position FOREIGN KEY (position_id) REFERENCES "position"(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_member_positions";`);
  }
}
