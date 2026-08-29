import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PendingAgentActions1787950604839 implements MigrationInterface {
  name = 'PendingAgentActions1787950604839';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "pending_agent_actions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "tenant_id" uuid NOT NULL,
        "action" character varying(80) NOT NULL,
        "params" jsonb NOT NULL DEFAULT '{}',
        "status" character varying(30) NOT NULL DEFAULT 'awaiting_approval',
        "requested_by_member_id" uuid,
        "api_key_id" uuid,
        "correlation_id" character varying(64),
        "idempotency_key" character varying(128),
        "result" jsonb,
        "approved_by_member_id" uuid,
        "actor_type" character varying(20) NOT NULL DEFAULT 'api_key',
        CONSTRAINT "PK_pending_agent_actions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pending_agent_actions_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pending_agent_actions_member" FOREIGN KEY ("requested_by_member_id") REFERENCES "tenant_members"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_pending_agent_actions_api_key" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_pending_agent_actions_idempotency" ON "pending_agent_actions" ("tenant_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pending_agent_actions_tenant_status" ON "pending_agent_actions" ("tenant_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "pending_agent_actions"`);
  }
}
