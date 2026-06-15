import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ShoutoutPointTransactions1781241332199 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE shoutout_point_transactions (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        member_id UUID NOT NULL,
        type VARCHAR(16) NOT NULL,
        points INTEGER NOT NULL,
        running_balance INTEGER NOT NULL,
        shoutout_id UUID,
        description VARCHAR,
        created_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_shoutout_point_transactions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_shoutout_point_transactions_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_shoutout_point_transactions_shoutout FOREIGN KEY (shoutout_id) REFERENCES shoutouts(id) ON DELETE SET NULL,
        CONSTRAINT fk_shoutout_point_transactions_created_by FOREIGN KEY (created_by) REFERENCES tenant_members(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE shoutout_point_transactions;`);
  }
}
