import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ShoutoutMemberPoints1795450757197 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE shoutout_member_points (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          member_id uuid NOT NULL,
          total_earned integer DEFAULT 0,
          total_given integer DEFAULT 0,
          current_balance integer DEFAULT 0,
          monthly_given integer DEFAULT 0,
          monthly_received integer DEFAULT 0,
          last_reset_date timestamp without time zone,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          deleted_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutout_member_points
          ADD CONSTRAINT shoutout_member_points_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutout_member_points
          ADD CONSTRAINT shoutout_member_points_tenant_id_member_id_key UNIQUE (tenant_id, member_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_shoutout_member_points_member_id ON shoutout_member_points USING btree (member_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_shoutout_member_points_tenant_id ON shoutout_member_points USING btree (tenant_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutout_member_points
          ADD CONSTRAINT fk_shoutout_member_points_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutout_member_points
          ADD CONSTRAINT fk_shoutout_member_points_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_shoutout_member_points_tenant_member ON shoutout_member_points (tenant_id, member_id) WHERE deleted_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "shoutout_member_points";`);
  }
}
