/**
 * Read-only audit: tenant wallet currency vs expected from tenant country/preferred currency.
 * Exits 1 when funded (locked) wallets have a currency mismatch that needs human review.
 *
 * Usage: pnpm --filter api audit:wallet-currency
 */
import { Logger } from '@nestjs/common';
import dataSource from '../common/database/config/data-source';
import {
  isWalletCurrencyLocked,
  resolveInitialWalletCurrency,
} from '../common/utils/rewards-defaults.util';

const logger = new Logger('AuditWalletCurrency');

type WalletAuditRow = {
  wallet_id: string;
  tenant_id: string;
  tenant_slug: string;
  wallet_currency: string;
  balance_amount: string;
  country_code: string | null;
  preferred_currency: string | null;
  transaction_count: string;
};

async function auditWalletCurrency(): Promise<void> {
  dataSource.setOptions({ migrationsRun: false });
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const rows = (await dataSource.query(`
    SELECT
      tw.id AS wallet_id,
      tw.tenant_id,
      t.slug AS tenant_slug,
      tw.currency_code AS wallet_currency,
      tw.balance_amount,
      t.country_code,
      t.preferred_currency,
      COUNT(twt.id)::text AS transaction_count
    FROM tenant_wallets tw
    INNER JOIN tenants t ON t.id = tw.tenant_id
    LEFT JOIN tenant_wallet_transactions twt ON twt.tenant_wallet_id = tw.id
    GROUP BY tw.id, tw.tenant_id, t.slug, tw.currency_code, tw.balance_amount, t.country_code, t.preferred_currency
    ORDER BY t.slug
  `)) as WalletAuditRow[];

  const lockedMismatches: WalletAuditRow[] = [];
  const unlockedMismatches: WalletAuditRow[] = [];

  for (const row of rows) {
    const expected = resolveInitialWalletCurrency(row.country_code, row.preferred_currency);
    const actual = (row.wallet_currency || '').toUpperCase();
    if (actual === expected) {
      continue;
    }

    const locked = isWalletCurrencyLocked(
      { balanceAmount: row.balance_amount },
      Number(row.transaction_count),
    );
    if (locked) {
      lockedMismatches.push(row);
    } else {
      unlockedMismatches.push(row);
    }
  }

  logger.log(`Audited ${rows.length} wallet(s)`);

  if (unlockedMismatches.length > 0) {
    logger.warn(
      `${unlockedMismatches.length} unlocked mismatch(es) — will auto-sync on next ensureWallet:`,
    );
    for (const row of unlockedMismatches) {
      const expected = resolveInitialWalletCurrency(row.country_code, row.preferred_currency);
      logger.warn(
        `  ${row.tenant_slug} (${row.tenant_id}): wallet=${row.wallet_currency} expected=${expected}`,
      );
    }
  }

  if (lockedMismatches.length > 0) {
    logger.error(
      `${lockedMismatches.length} locked mismatch(es) — manual review required before go-live:`,
    );
    for (const row of lockedMismatches) {
      const expected = resolveInitialWalletCurrency(row.country_code, row.preferred_currency);
      logger.error(
        `  ${row.tenant_slug} (${row.tenant_id}): wallet=${row.wallet_currency} expected=${expected} balance=${row.balance_amount} txCount=${row.transaction_count}`,
      );
    }
    throw new Error('Locked wallet currency mismatches found');
  }

  logger.log('No locked wallet currency mismatches');
}

auditWalletCurrency()
  .then(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(0);
  })
  .catch(async (error: Error) => {
    logger.error(error.message, error.stack);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  });
