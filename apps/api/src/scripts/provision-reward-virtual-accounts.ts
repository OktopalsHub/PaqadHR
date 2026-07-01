import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import dataSource from '../common/database/config/data-source';
import { TenantWalletService } from '../modules/v1/rewards/services/tenant-wallet.service';

const logger = new Logger('ProvisionRewardVAs');

async function main(): Promise<void> {
  dataSource.setOptions({ migrationsRun: false });
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const walletService = app.get(TenantWalletService);
    const result = await walletService.provisionMissingVirtualAccounts();
    logger.log(
      `Done: provisioned=${result.provisioned}, skipped=${result.skipped}, failed=${result.failed}`,
    );
  } finally {
    await app.close();
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    logger.error(`Fatal: ${err.message}`, err.stack);
    process.exit(1);
  });
