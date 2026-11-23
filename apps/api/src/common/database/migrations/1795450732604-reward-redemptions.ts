import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RewardRedemptions1795450732604 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE reward_redemptions (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          member_id uuid NOT NULL,
          reward_type character varying(24) NOT NULL,
          reward_id character varying,
          reward_name character varying,
          points_spent integer NOT NULL,
          currency_value numeric(14,2) NOT NULL,
          currency_code character varying(8) DEFAULT 'NGN'::character varying,
          status character varying(16) DEFAULT 'PENDING'::character varying,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          recipient jsonb,
          voucher jsonb,
          provider_ref jsonb,
          processing_started_at timestamp with time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY reward_redemptions
          ADD CONSTRAINT reward_redemptions_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_reward_redemptions_member_id ON reward_redemptions USING btree (member_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_reward_redemptions_status ON reward_redemptions USING btree (status);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_reward_redemptions_tenant_id ON reward_redemptions USING btree (tenant_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY reward_redemptions
          ADD CONSTRAINT fk_reward_redemptions_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY reward_redemptions
          ADD CONSTRAINT fk_reward_redemptions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reward_redemptions";`);
  }
}
