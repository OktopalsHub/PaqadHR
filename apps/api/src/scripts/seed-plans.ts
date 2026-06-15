import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import dataSource from '../common/database/config/data-source';
import { PlanSeederService } from '../modules/v1/plans/services/plan-seeder.service';

const logger = new Logger('SeedPlans');

async function seedPlans(): Promise<void> {
  logger.log('Initializing database connection...');

  dataSource.setOptions({ migrationsRun: false });

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  logger.log('Database connected. Running plan seeder...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const seeder = app.get(PlanSeederService);
    await seeder.seedPlans();
    logger.log('Plan seed completed successfully');
  } finally {
    await app.close();
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

seedPlans()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    logger.error(`Fatal error: ${err.message}`, err.stack);
    process.exit(1);
  });
