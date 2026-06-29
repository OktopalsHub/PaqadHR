import { Logger, RequestMethod, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { EnvironmentValidationService } from './common/config/environment-validation.service';
import { ExpressSetup } from './common/config/express.config';
import { setupSwagger } from './common/config/swagger.config';
import { waitForDatabase } from './common/database/config/data-source';

async function bootstrap() {
  new EnvironmentValidationService().validateEnvironment();
  await waitForDatabase();

  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: isProduction ? ['error', 'warn', 'log'] : ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  ExpressSetup(app);
  if (!isProduction) {
    setupSwagger(app);
  }

  app.setGlobalPrefix('api', {
    exclude: [
      { path: '/', method: RequestMethod.GET },
      { path: '/health', method: RequestMethod.GET },
      { path: '/metrics', method: RequestMethod.GET },
      { path: '/csrf/token', method: RequestMethod.GET },
      { path: '/docs', method: RequestMethod.GET },
      { path: '/integrations/oauth/callback', method: RequestMethod.GET },
    ],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const port = process.env.PORT || 9001;
  await app.listen(port, '::');

  if (isDevelopment) {
    logger.log(`Application is running on: http://localhost:${port}`);
    logger.log(`Environment: ${process.env.NODE_ENV}`);
    logger.log(`API Documentation: http://localhost:${port}/docs`);
  } else {
    logger.log(`Application is running on port ${port}`);
  }
}
bootstrap();
