import { MigrationInterface, QueryRunner } from 'typeorm';

export class Account1781241198793 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS account (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        user_id UUID,
        account_id VARCHAR(255),
        provider_id VARCHAR(255),
        access_token TEXT,
        refresh_token TEXT,
        id_token TEXT,
        access_token_expires_at TIMESTAMP,
        refresh_token_expires_at TIMESTAMP,
        scope TEXT,
        password TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_account_user FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_account_user_id ON account(user_id);`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_account_provider ON account(provider_id, account_id)
      WHERE provider_id IS NOT NULL AND account_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS account;`);
  }
}
