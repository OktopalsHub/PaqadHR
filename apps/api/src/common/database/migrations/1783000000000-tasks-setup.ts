import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TasksSetup1783000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE rewards_tasks (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        title VARCHAR NOT NULL,
        description TEXT NOT NULL,
        points INTEGER NOT NULL,
        icon VARCHAR NOT NULL,
        category VARCHAR,
        image_url VARCHAR,
        submission_type VARCHAR DEFAULT 'instant',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_rewards_tasks_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE rewards_task_submissions (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        task_id UUID NOT NULL,
        member_id UUID NOT NULL,
        status VARCHAR DEFAULT 'pending',
        submission_text TEXT,
        submission_file_name VARCHAR,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_task_submissions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_task_submissions_task FOREIGN KEY (task_id) REFERENCES rewards_tasks(id) ON DELETE CASCADE,
        CONSTRAINT fk_task_submissions_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_rewards_tasks_tenant_id ON rewards_tasks(tenant_id);
      CREATE INDEX idx_task_submissions_tenant_id ON rewards_task_submissions(tenant_id);
      CREATE INDEX idx_task_submissions_task_id ON rewards_task_submissions(task_id);
      CREATE INDEX idx_task_submissions_member_id ON rewards_task_submissions(member_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rewards_task_submissions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS rewards_tasks;`);
  }
}
