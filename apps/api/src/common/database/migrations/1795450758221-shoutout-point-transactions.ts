import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ShoutoutPointTransactions1795450758221 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE shoutout_point_transactions (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          member_id uuid NOT NULL,
          type character varying(16) NOT NULL,
          points integer NOT NULL,
          running_balance integer NOT NULL,
          shoutout_id uuid,
          description character varying,
          created_by uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          deleted_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutout_point_transactions
          ADD CONSTRAINT shoutout_point_transactions_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutout_point_transactions
          ADD CONSTRAINT fk_shoutout_point_transactions_created_by FOREIGN KEY (created_by) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutout_point_transactions
          ADD CONSTRAINT fk_shoutout_point_transactions_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutout_point_transactions
          ADD CONSTRAINT fk_shoutout_point_transactions_shoutout FOREIGN KEY (shoutout_id) REFERENCES shoutouts(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutout_point_transactions
          ADD CONSTRAINT fk_shoutout_point_transactions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "shoutout_point_transactions";`);
  }
}
