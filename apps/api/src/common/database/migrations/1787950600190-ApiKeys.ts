import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ApiKeys1787950600190 implements MigrationInterface {
  name = 'ApiKeys1787950600190';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "tenant_id" uuid NOT NULL,
        "created_by_member_id" uuid NOT NULL,
        "name" character varying(120) NOT NULL,
        "key_prefix" character varying(16) NOT NULL,
        "key_hash" text NOT NULL,
        "scopes" jsonb NOT NULL DEFAULT '[]',
        "expires_at" TIMESTAMP,
        "last_used_at" TIMESTAMP,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_api_keys" PRIMARY KEY ("id"),
        CONSTRAINT "FK_api_keys_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_api_keys_member" FOREIGN KEY ("created_by_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_api_keys_tenant_prefix" ON "api_keys" ("tenant_id", "key_prefix")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "api_keys"`);
  }
}
