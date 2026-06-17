import type { MigrationInterface, QueryRunner } from 'typeorm';

export class User1781241191518 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        name VARCHAR(100),
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255),
        email_verified BOOLEAN DEFAULT FALSE,
        country_code CHAR(2),
        image_key VARCHAR(100),
        is_active BOOLEAN NOT NULL DEFAULT true,
        role VARCHAR(20) DEFAULT 'basic',
        deleted_at TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_country_code ON "user"(country_code);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user";`);
  }
}
