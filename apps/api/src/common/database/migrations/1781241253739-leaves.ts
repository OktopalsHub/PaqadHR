import { MigrationInterface, QueryRunner } from 'typeorm';

export class Leaves1781241253739 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE leaves (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        reviewed_at TIMESTAMP,
        comments TEXT,
        duration INTEGER NOT NULL,
        leave_type_id UUID NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        reason TEXT,
        approved_by UUID,
        requested_by UUID NOT NULL,
        tenant_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_leaves_leave_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
        CONSTRAINT fk_leaves_approved_by FOREIGN KEY (approved_by) REFERENCES tenant_members(id),
        CONSTRAINT fk_leaves_requested_by FOREIGN KEY (requested_by) REFERENCES tenant_members(id),
        CONSTRAINT fk_leaves_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE leaves;`);
  }
}
