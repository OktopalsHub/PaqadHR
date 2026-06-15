import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Assessment1781241305935 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE assessment (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        type VARCHAR NOT NULL,
        title VARCHAR NOT NULL,
        description TEXT NOT NULL,
        questions JSON NOT NULL,
        duration INTEGER NOT NULL,
        passing_score INTEGER NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        tenant_member_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_assessment_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id),
        CONSTRAINT fk_assessment_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE assessment;`);
  }
}
