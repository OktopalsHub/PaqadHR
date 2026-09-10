import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Logger, RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../app.module';
import { buildOpenApiDocument } from '../common/config/swagger.config';

async function exportOpenApi(): Promise<void> {
  const logger = new Logger('OpenAPIExport');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn'],
    abortOnError: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api', {
    exclude: [
      { path: '/', method: RequestMethod.GET },
      { path: '/health', method: RequestMethod.GET },
      { path: '/metrics', method: RequestMethod.GET },
      { path: '/csrf/token', method: RequestMethod.GET },
      { path: '/docs', method: RequestMethod.GET },
      { path: '/integrations/oauth/callback', method: RequestMethod.GET },
      { path: '/agent/actions', method: RequestMethod.POST },
    ],
  });

  const document = buildOpenApiDocument(app);
  const outputPath = resolve(process.cwd(), '../../docs/openapi.json');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  await app.close();
  logger.log(`OpenAPI spec written to ${outputPath}`);
}

const timeoutMs = 60_000;
const timer = setTimeout(() => {
  console.error('OpenAPI export timed out — is DATABASE_URL reachable?');
  process.exit(1);
}, timeoutMs);

exportOpenApi()
  .then(() => clearTimeout(timer))
  .catch((error) => {
    clearTimeout(timer);
    console.error(error);
    process.exit(1);
  });
