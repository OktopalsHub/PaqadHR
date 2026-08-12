/**
 * Creates or reuses Bachs shell catalog products for rewards wallet top-up (NGN + USD).
 * Paste the printed env vars into apps/api/.env — ad-hoc checkout amounts override catalog price.
 *
 * Usage: BACHS_SECRET_KEY=sk_sandbox_... pnpm --filter api sync:bachs-wallet-products
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BachsApiService } from '../common/services/bachs-api.service';

const logger = new Logger('SyncBachsWalletProducts');

const SHELLS = [
  {
    envKey: 'BACHS_WALLET_TOPUP_PRODUCT_NGN',
    name: 'Paqad Wallet Top-up (NGN)',
    currency: 'NGN',
    metadata: { paqad: 'true', paqad_wallet_topup: 'true', currency: 'NGN' },
  },
  {
    envKey: 'BACHS_WALLET_TOPUP_PRODUCT_USD',
    name: 'Paqad Wallet Top-up (USD)',
    currency: 'USD',
    metadata: { paqad: 'true', paqad_wallet_topup: 'true', currency: 'USD' },
  },
] as const;

async function syncWalletProducts(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const bachsApi = app.get(BachsApiService);
    if (!bachsApi.isConfigured()) {
      throw new Error('BACHS_SECRET_KEY is not set');
    }

    const existing = await bachsApi.listProducts();
    const walletProducts = existing.filter((item) => {
      const metadata = item.metadata as Record<string, string> | undefined;
      return metadata?.paqad_wallet_topup === 'true';
    });

    logger.log('Add these to apps/api/.env:\n');

    for (const shell of SHELLS) {
      const match = walletProducts.find((item) => {
        const metadata = item.metadata as Record<string, string> | undefined;
        return metadata?.currency === shell.currency;
      });

      let productId = typeof match?.id === 'string' ? match.id : undefined;

      if (!productId) {
        const created = await bachsApi.createProduct({
          name: shell.name,
          description: 'Shell product for Paqad rewards wallet top-up (amount set per checkout)',
          currency: shell.currency,
          amount: '100.00',
          metadata: shell.metadata,
        });
        productId = created.id;
        logger.log(`Created ${shell.currency} wallet shell product: ${productId}`);
      } else {
        logger.log(`Reusing ${shell.currency} wallet shell product: ${productId}`);
      }

      logger.log(`${shell.envKey}=${productId}`);
    }
  } finally {
    await app.close();
  }
}

syncWalletProducts()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    logger.error(error.message, error.stack);
    process.exit(1);
  });
