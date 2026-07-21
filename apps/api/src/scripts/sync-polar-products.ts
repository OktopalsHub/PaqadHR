/**
 * Creates or reuses Polar recurring products with seat-based pricing.
 * Stores product IDs on plan_prices.polar_product_id.
 * Usage: POLAR_ACCESS_TOKEN=pat_... pnpm --filter api sync:polar-products
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import dataSource from '../common/database/config/data-source';
import { BillingProductSyncService } from '../modules/v1/subscriptions/services/billing-product-sync.service';

const logger = new Logger('SyncPolarProducts');

async function syncProducts(): Promise<void> {
  dataSource.setOptions({ migrationsRun: false });
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const sync = app.get(BillingProductSyncService);
    const { updated } = await sync.syncPolarProducts();
    logger.log(`Done. ${updated} plan price row(s) updated.`);
  } finally {
    await app.close();
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

syncProducts()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    logger.error(error.message, error.stack);
    process.exit(1);
  });
