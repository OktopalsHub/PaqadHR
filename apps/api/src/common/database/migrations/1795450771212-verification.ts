import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Verification1795450771212 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE verification (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          identifier character varying(100) NOT NULL,
          token character varying(255) NOT NULL,
          expires_at timestamp without time zone NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY verification
          ADD CONSTRAINT uqx_identifier_token UNIQUE (identifier, token);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY verification
          ADD CONSTRAINT verification_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY verification
          ADD CONSTRAINT verification_token_key UNIQUE (token);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "verification";`);
  }
}
