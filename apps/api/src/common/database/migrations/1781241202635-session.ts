import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Session1781241202635 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS session (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        user_id UUID,
        expires_at TIMESTAMP NOT NULL,
        token TEXT UNIQUE NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(user_id);`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_session_token ON session(token);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS session;`);
  }
}
