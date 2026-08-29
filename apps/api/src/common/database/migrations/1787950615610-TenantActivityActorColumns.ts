import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantActivityActorColumns1787950615610 implements MigrationInterface {
  name = 'TenantActivityActorColumns1787950615610';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenant_activities" ADD COLUMN "actor_type" character varying(20) NOT NULL DEFAULT 'user'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_activities" ADD COLUMN "correlation_id" character varying(64)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenant_activities" DROP COLUMN "correlation_id"`);
    await queryRunner.query(`ALTER TABLE "tenant_activities" DROP COLUMN "actor_type"`);
  }
}
