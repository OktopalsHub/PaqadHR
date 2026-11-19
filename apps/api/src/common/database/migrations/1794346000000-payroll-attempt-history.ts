import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollAttemptHistory1794346000000 implements MigrationInterface {
  name = 'PayrollAttemptHistory1794346000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payroll_funding_attempts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,
        purpose varchar(24) NOT NULL CHECK (purpose IN ('run_funding', 'retry_shortfall')),
        attempt_number integer NOT NULL CHECK (attempt_number > 0),
        provider varchar(24) NOT NULL,
        status varchar(24) NOT NULL CHECK (status IN (
          'created', 'pending', 'processing', 'confirmed', 'reversed', 'failed',
          'cancelled', 'expired', 'requires_review'
        )),
        order_reference varchar(255) NOT NULL,
        idempotency_key varchar(255) NOT NULL,
        currency varchar(10) NOT NULL,
        amount numeric(30, 12) NOT NULL CHECK (amount > 0),
        checkout_amount numeric(30, 12) NULL CHECK (checkout_amount IS NULL OR checkout_amount >= 0),
        balance_applied numeric(30, 12) NULL CHECK (balance_applied IS NULL OR balance_applied >= 0),
        selected_item_ids jsonb NULL,
        provider_reference varchar(255) NULL,
        created_by_id uuid NULL,
        confirmed_at timestamp NULL,
        cancelled_at timestamp NULL,
        expires_at timestamp NULL,
        metadata jsonb NULL,
        CONSTRAINT uq_payroll_funding_attempt_idempotency UNIQUE (idempotency_key),
        CONSTRAINT uq_payroll_funding_attempt_provider_ref UNIQUE (provider, order_reference),
        CONSTRAINT uq_payroll_funding_attempt_run_number
          UNIQUE (payroll_run_id, purpose, attempt_number)
      );
      CREATE INDEX ix_payroll_funding_attempt_tenant_status
        ON payroll_funding_attempts (tenant_id, status, created_at);
      CREATE INDEX ix_payroll_funding_attempt_run_created
        ON payroll_funding_attempts (payroll_run_id, created_at);
      CREATE UNIQUE INDEX uq_payroll_funding_attempt_provider_reference
        ON payroll_funding_attempts (provider, provider_reference)
        WHERE provider_reference IS NOT NULL;

      CREATE TABLE payroll_payout_attempts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,
        payroll_item_id uuid NOT NULL REFERENCES payroll_items(id) ON DELETE RESTRICT,
        attempt_number integer NOT NULL CHECK (attempt_number > 0),
        provider varchar(24) NOT NULL,
        status varchar(24) NOT NULL CHECK (status IN (
          'created', 'processing', 'payment_processed', 'failed', 'requires_review', 'reversed'
        )),
        merchant_reference varchar(255) NULL,
        provider_reference varchar(255) NULL,
        idempotency_key varchar(255) NOT NULL,
        source_amount numeric(30, 12) NULL CHECK (source_amount IS NULL OR source_amount > 0),
        source_currency varchar(10) NULL,
        destination_amount numeric(30, 12) NOT NULL CHECK (destination_amount > 0),
        destination_currency varchar(10) NOT NULL,
        submitted_at timestamp NULL,
        settled_at timestamp NULL,
        metadata jsonb NULL,
        CONSTRAINT uq_payroll_payout_attempt_idempotency UNIQUE (idempotency_key),
        CONSTRAINT uq_payroll_payout_attempt_item_provider_number
          UNIQUE (payroll_item_id, provider, attempt_number)
      );
      CREATE UNIQUE INDEX uq_payroll_payout_attempt_provider_merchant_ref
        ON payroll_payout_attempts (provider, merchant_reference)
        WHERE merchant_reference IS NOT NULL;
      CREATE UNIQUE INDEX uq_payroll_payout_attempt_provider_reference
        ON payroll_payout_attempts (provider, provider_reference)
        WHERE provider_reference IS NOT NULL;
      CREATE INDEX ix_payroll_payout_attempt_tenant_status
        ON payroll_payout_attempts (tenant_id, status, created_at);
      CREATE INDEX ix_payroll_payout_attempt_run_created
        ON payroll_payout_attempts (payroll_run_id, created_at);

      WITH funding_states AS (
        SELECT r.id AS payroll_run_id, r.tenant_id, r.base_currency, r.updated_at AS run_updated_at,
               'run_funding'::varchar AS purpose, r.metadata::jsonb -> 'floatTopup' AS state_data
        FROM payroll_runs r
        WHERE r.metadata::jsonb ? 'floatTopup'
        UNION ALL
        SELECT r.id, r.tenant_id, r.base_currency, r.updated_at,
               'retry_shortfall'::varchar, r.metadata::jsonb -> 'retryFunding'
        FROM payroll_runs r
        WHERE r.metadata::jsonb ? 'retryFunding'
      ), funding_refs AS (
        SELECT fs.*, fs.state_data ->> 'orderReference' AS order_reference, true AS is_current,
               false AS is_cancelled
        FROM funding_states fs
        WHERE NULLIF(fs.state_data ->> 'orderReference', '') IS NOT NULL
        UNION ALL
        SELECT fs.*, ref.value, false, false
        FROM funding_states fs
        CROSS JOIN LATERAL jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(fs.state_data -> 'references') = 'array'
               THEN fs.state_data -> 'references' ELSE '[]'::jsonb END
        ) AS ref(value)
        UNION ALL
        SELECT fs.*, ref.value, false, true
        FROM funding_states fs
        CROSS JOIN LATERAL jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(fs.state_data -> 'cancelledOrderReferences') = 'array'
               THEN fs.state_data -> 'cancelledOrderReferences' ELSE '[]'::jsonb END
        ) AS ref(value)
      ), funding_numbered AS (
        SELECT fr.*,
               row_number() OVER (
                 PARTITION BY fr.payroll_run_id, fr.purpose ORDER BY fr.order_reference
               )::integer AS attempt_number
        FROM funding_refs fr
      )
      INSERT INTO payroll_funding_attempts (
        tenant_id, payroll_run_id, purpose, attempt_number, provider, status,
        order_reference, idempotency_key, currency, amount, checkout_amount,
        balance_applied, selected_item_ids, provider_reference, metadata, created_at, updated_at
      )
      SELECT fn.tenant_id, fn.payroll_run_id, fn.purpose, fn.attempt_number,
             left(lower(COALESCE(NULLIF(fn.state_data ->> 'provider', ''), 'unknown')), 24),
             CASE
               WHEN fn.is_cancelled OR fn.state_data ->> 'status' = 'cancelled' THEN 'cancelled'
               WHEN fn.state_data ->> 'status' IN ('reversed', 'refunded') THEN 'reversed'
               WHEN fn.state_data ->> 'status' IN ('completed', 'funded') THEN 'confirmed'
               WHEN fn.is_current AND fn.state_data ->> 'status' IN ('pending', 'approved') THEN 'pending'
               ELSE 'requires_review'
             END,
             fn.order_reference,
             'legacy:funding:' || fn.payroll_run_id::text || ':' || fn.purpose || ':' || fn.order_reference,
             upper(COALESCE(NULLIF(fn.state_data ->> 'currency', ''),
                            NULLIF(fn.state_data ->> 'fundingCurrency', ''), fn.base_currency)),
             COALESCE(NULLIF(fn.state_data ->> 'amount', '')::numeric,
                      NULLIF(fn.state_data ->> 'shortfall', '')::numeric),
             NULLIF(COALESCE(fn.state_data ->> 'checkoutAmount', fn.state_data ->> 'shortfall'), '')::numeric,
             NULLIF(fn.state_data ->> 'balanceApplied', '')::numeric,
             CASE WHEN jsonb_typeof(fn.state_data -> 'selectedItemIds') = 'array'
                  THEN fn.state_data -> 'selectedItemIds' ELSE NULL END,
             fn.order_reference,
             jsonb_build_object('migratedFromRunMetadata', true, 'historicalReference', NOT fn.is_current),
             COALESCE(NULLIF(fn.state_data ->> 'checkoutRequestedAt', '')::timestamp,
                      NULLIF(fn.state_data ->> 'approvedAt', '')::timestamp, fn.run_updated_at),
             fn.run_updated_at
      FROM funding_numbered fn
      WHERE NULLIF(fn.order_reference, '') IS NOT NULL
        AND COALESCE(NULLIF(fn.state_data ->> 'amount', '')::numeric,
                     NULLIF(fn.state_data ->> 'shortfall', '')::numeric, 0) > 0
      ON CONFLICT DO NOTHING;

      INSERT INTO payroll_payout_attempts (
        tenant_id, payroll_run_id, payroll_item_id, attempt_number, provider, status,
        merchant_reference, provider_reference, idempotency_key, source_amount,
        source_currency, destination_amount, destination_currency, submitted_at, settled_at, metadata,
        created_at, updated_at
      )
      SELECT op.tenant_id, op.payroll_run_id, op.payroll_item_id,
             row_number() OVER (PARTITION BY op.payroll_item_id, op.provider ORDER BY op.created_at)::integer,
             lower(op.provider),
             CASE op.status WHEN 'completed' THEN 'payment_processed'
                            WHEN 'failed' THEN 'failed'
                            WHEN 'requires_review' THEN 'requires_review'
                            ELSE 'processing' END,
             op.idempotency_key, op.provider_reference, op.idempotency_key,
             op.source_amount, upper(op.source_currency),
             COALESCE(NULLIF(op.metadata ->> 'fiatDestinationAmount', '')::numeric, op.destination_amount),
             upper(COALESCE(NULLIF(op.metadata ->> 'fiatDestinationCurrency', ''), op.destination_currency)),
             op.created_at,
             CASE WHEN op.status = 'completed' THEN op.updated_at ELSE NULL END,
             jsonb_build_object('migratedFromWalletOperationId', op.id, 'payoutMode', op.metadata ->> 'payoutMode'),
             op.created_at, op.updated_at
      FROM wallet_operations op
      WHERE op.payroll_item_id IS NOT NULL
        AND op.payroll_run_id IS NOT NULL
        AND op.kind = 'transfer'
        AND op.provider = 'bridge'
      ON CONFLICT DO NOTHING;

      INSERT INTO payroll_payout_attempts (
        tenant_id, payroll_run_id, payroll_item_id, attempt_number, provider, status,
        merchant_reference, provider_reference, idempotency_key, destination_amount,
        destination_currency, submitted_at, settled_at, metadata, created_at, updated_at
      )
      SELECT run.tenant_id, item.payroll_run_id, item.id,
             GREATEST(COALESCE(NULLIF(item.metadata::jsonb ->> 'nombaPayoutAttempt', '')::integer, 1), 1),
             CASE WHEN lower(COALESCE(item.payment_provider, '')) LIKE '%nomba%' THEN 'nomba'
                  WHEN lower(COALESCE(item.payment_provider, '')) LIKE '%bridge%' THEN 'bridge'
                  WHEN lower(COALESCE(item.payment_provider, '')) LIKE '%bachs%' THEN 'bachs'
                  WHEN lower(COALESCE(item.payment_provider, '')) LIKE '%fincra%' THEN 'fincra'
                  WHEN lower(COALESCE(item.payment_provider, '')) LIKE '%monnify%' THEN 'monnify'
                  WHEN lower(COALESCE(item.payment_provider, '')) LIKE '%noah%'
                    OR lower(COALESCE(item.payment_provider, '')) LIKE '%crypto%' THEN 'noah'
                  ELSE 'unknown' END,
             CASE item.status WHEN 'paid' THEN 'payment_processed'
                              WHEN 'failed' THEN 'failed'
                              WHEN 'processing' THEN 'processing'
                              ELSE 'created' END,
             COALESCE(item.metadata::jsonb ->> 'nombaMerchantTxRef', item.transaction_id),
             CASE WHEN item.metadata::jsonb ->> 'nombaMerchantTxRef' IS DISTINCT FROM item.transaction_id
                  THEN item.transaction_id ELSE NULL END,
             'legacy:payroll-item:' || item.id::text,
             item.payment_amount, upper(COALESCE(item.payment_currency, run.base_currency)),
             item.updated_at,
             CASE WHEN item.status = 'paid' THEN item.paid_at ELSE NULL END,
             jsonb_build_object('migratedFromPayrollItem', true, 'originalProvider', item.payment_provider),
             COALESCE(item.paid_at, item.updated_at), item.updated_at
      FROM payroll_items item
      JOIN payroll_runs run ON run.id = item.payroll_run_id
      WHERE item.transaction_id IS NOT NULL OR item.metadata::jsonb ? 'nombaMerchantTxRef'
      ON CONFLICT DO NOTHING;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count: fundingCount }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM payroll_funding_attempts',
    )) as Array<{ count: string }>;
    const [{ count: payoutCount }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM payroll_payout_attempts',
    )) as Array<{ count: string }>;
    if (Number(fundingCount) > 0 || Number(payoutCount) > 0) {
      throw new Error('Refusing to drop populated payroll attempt history.');
    }
    await queryRunner.query('DROP TABLE payroll_payout_attempts');
    await queryRunner.query('DROP TABLE payroll_funding_attempts');
  }
}
