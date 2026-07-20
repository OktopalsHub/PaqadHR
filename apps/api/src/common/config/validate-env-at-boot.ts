import { Logger } from '@nestjs/common';
import { resolveTrustedOrigins } from './trusted-origins';

const CRITICAL = [
  'DATABASE_URL',
  'ACCESS_SECRET',
  'REFRESH_SECRET',
  'ENCRYPTION_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
] as const;

export function validateEnvAtBoot(): void {
  const logger = new Logger('EnvValidation');
  const isProduction = (process.env.NODE_ENV || 'development') === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const key of CRITICAL) {
    if (!process.env[key]?.trim()) {
      errors.push(`${key} is not set`);
    }
  }

  if (resolveTrustedOrigins().length === 0) {
    errors.push('TRUSTED_ORIGINS is not set');
  }

  const publicId = process.env.R2_PUBLIC_ID?.trim();
  const customDomain = process.env.R2_CUSTOM_DOMAIN?.trim();
  if (!publicId && !customDomain) {
    errors.push('Set R2_PUBLIC_ID or R2_CUSTOM_DOMAIN for public file URLs');
  }

  const encryptionKey = process.env.ENCRYPTION_KEY?.trim();
  if (encryptionKey && encryptionKey.length < 32) {
    errors.push('ENCRYPTION_KEY must be at least 32 characters');
  }

  if (isProduction) {
    const nombaOk =
      process.env.NOMBA_CLIENT_ID?.trim() &&
      process.env.NOMBA_CLIENT_SECRET?.trim() &&
      (process.env.NOMBA_PARENT_ACCOUNT_ID?.trim() || process.env.NOMBA_ACCOUNT_ID?.trim());
    if (!nombaOk) {
      warnings.push(
        'Nomba billing is not fully configured (NOMBA_CLIENT_ID/SECRET/PARENT_ACCOUNT_ID)',
      );
    }
    if (!process.env.NOMBA_WEBHOOK_SIGNATURE_KEY?.trim()) {
      warnings.push(
        'NOMBA_WEBHOOK_SIGNATURE_KEY is not set — Nomba webhooks will reject signatures',
      );
    }
    if (!process.env.NOAH_API_KEY?.trim()) {
      warnings.push('NOAH_API_KEY is not set — non-NGN payments will be unavailable');
    }
    if (
      process.env.NOAH_ENVIRONMENT === 'production' &&
      !process.env.NOAH_SIGNING_PRIVATE_KEY?.trim()
    ) {
      warnings.push(
        'NOAH_SIGNING_PRIVATE_KEY is not set — Noah API signing may fail in production',
      );
    }
    if (process.env.NOMBA_LIVE === 'true') {
      logger.log('Nomba live mode enabled (NOMBA_LIVE=true)');
    }
    if (process.env.RELOADLY_CLIENT_ID?.trim() && !process.env.RELOADLY_WEBHOOK_SECRET?.trim()) {
      warnings.push('RELOADLY_WEBHOOK_SECRET is not set — Reloadly webhooks will fail');
    }
  }

  for (const warning of warnings) {
    logger.warn(warning);
  }

  if (errors.length > 0) {
    const message = `Environment validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`;
    logger.error(message);
    throw new Error(message);
  }

  logger.log('Environment validation passed');
}
