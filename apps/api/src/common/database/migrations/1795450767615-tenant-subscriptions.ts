import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantSubscriptions1795450767615 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenant_subscriptions (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          plan_id uuid NOT NULL,
          plan_price_id uuid NOT NULL,
          status character varying(32) DEFAULT 'TRIAL'::character varying NOT NULL,
          current_users integer DEFAULT 0 NOT NULL,
          trial_ends_at timestamp without time zone,
          current_period_start timestamp without time zone NOT NULL,
          current_period_end timestamp without time zone NOT NULL,
          next_billing_date timestamp without time zone NOT NULL,
          nomba_subscription_id character varying(100),
          payment_method_id character varying(100),
          usage_metrics jsonb,
          billing_history jsonb,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          cancel_at_period_end boolean DEFAULT false NOT NULL,
          cancelled_at timestamp without time zone,
          cancellation_reason text,
          paused_at timestamp without time zone,
          dunning_attempt_count integer DEFAULT 0 NOT NULL,
          dunning_next_retry_at timestamp without time zone,
          last_payment_failure_reason character varying,
          last_payment_failure_detail text,
          payment_method_brand character varying,
          payment_method_last_four character varying(4),
          billing_provider character varying(16) DEFAULT 'nomba'::character varying NOT NULL,
          noah_customer_id character varying(100),
          external_subscription_id character varying(100)
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_subscriptions
          ADD CONSTRAINT tenant_subscriptions_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_tenant_subscriptions_tenant ON tenant_subscriptions USING btree (tenant_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_subscriptions
          ADD CONSTRAINT fk_tenant_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_subscriptions
          ADD CONSTRAINT fk_tenant_subscriptions_plan_price FOREIGN KEY (plan_price_id) REFERENCES plan_prices(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_subscriptions
          ADD CONSTRAINT fk_tenant_subscriptions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_subscriptions";`);
  }
}
