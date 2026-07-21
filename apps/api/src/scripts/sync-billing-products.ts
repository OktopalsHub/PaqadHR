/**
 * Syncs both Bachs and Polar products onto plan_prices.
 * Usage: pnpm --filter api sync:billing-products
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { isBachsConfigured } from '../common/config/bachs.config';
import { isPolarConfigured } from '../common/config/polar.config';
import dataSource from '../common/database/config/data-source';
import { BillingProductSyncService } from '../modules/v1/subscriptions/services/billing-product-sync.service';

const logger = new Logger('SyncBillingProducts');

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

    if (isBachsConfigured()) {
      const { updated } = await sync.syncBachsProducts();
      logger.log(`Bachs: ${updated} plan price row(s) updated.`);
    } else {
      logger.warn('Skipping Bachs — BACHS_SECRET_KEY is not set');
    }

    if (isPolarConfigured()) {
      const { updated } = await sync.syncPolarProducts();
      logger.log(`Polar: ${updated} plan price row(s) updated.`);
    } else {
      logger.warn('Skipping Polar — POLAR_ACCESS_TOKEN is not set');
    }
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
