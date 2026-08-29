import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AgentActionIdempotency1787950608947 implements MigrationInterface {
  name = 'AgentActionIdempotency1787950608947';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "agent_action_idempotency" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "tenant_id" uuid NOT NULL,
        "idempotency_key" character varying(128) NOT NULL,
        "action" character varying(80) NOT NULL,
        "response" jsonb NOT NULL,
        CONSTRAINT "PK_agent_action_idempotency" PRIMARY KEY ("id"),
        CONSTRAINT "FK_agent_action_idempotency_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_agent_action_idempotency_key" ON "agent_action_idempotency" ("tenant_id", "idempotency_key")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "agent_action_idempotency"`);
  }
}
