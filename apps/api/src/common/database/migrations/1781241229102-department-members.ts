import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DepartmentMembers1781241229102 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE department_members (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        department_id UUID NOT NULL,
        member_id UUID NOT NULL,
        role VARCHAR(50),
        joined_at DATE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_department_members_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
        CONSTRAINT fk_department_members_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT unique_department_member UNIQUE (department_id, member_id)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE department_members;`);
  }
}
