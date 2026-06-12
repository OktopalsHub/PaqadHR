
import {
  Logger as NestLogger,
  RequestMethod,
  VersioningType,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { setupSwagger } from './common/config/swagger.config';
import { ExpressSetup } from './common/config/express.config';
import { EnvironmentValidationService } from './common/config/environment-validation.service';

async function bootstrap() {
  new EnvironmentValidationService().validateEnvironment();
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger: isProduction
      ? ['error', 'warn']
      : isDevelopment
        ? ['log', 'error', 'warn', 'debug', 'verbose']
        : ['log', 'error', 'warn'],
  });
  try {
    app.useLogger(app.get(Logger, { strict: false }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    NestLogger.error(`Failed to initialize Pino logger: ${message}`);
  }
  ExpressSetup(app);
  if (process.env.NODE_ENV !== 'production') {
    setupSwagger(app);
  }
  app.setGlobalPrefix('api', {
    exclude: [
      {
        path: '/',
        method: RequestMethod.GET,
      },
      { path: '/health', method: RequestMethod.GET },
      { path: '/csrf/token', method: RequestMethod.GET },
      { path: '/docs', method: RequestMethod.GET },
      { path: '/integrations/oauth/callback', method: RequestMethod.GET },
    ],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  const port = process.env.PORT || 3000;
  await app.listen(port, '::');
  const logger = app.get(Logger, { strict: false });
  if (isDevelopment) {
    logger.log(
      `Application is running on: http://localhost:${port}`,
      'Bootstrap',
    );
    logger.log(`Environment: ${process.env.NODE_ENV}`, 'Bootstrap');
    logger.log(
      `Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`,
      'Bootstrap',
    );
    logger.log(
      `API Documentation: http://localhost:${port}/docs`,
      'Bootstrap',
    );
  } else {
    logger.log(`Application is running on port ${port}`, 'Bootstrap');
  }
}
bootstrap();
