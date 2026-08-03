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
    const ngPaymentsProvider = (process.env.NG_PAYMENTS_PROVIDER || 'nomba').trim().toLowerCase();
    if (
      ngPaymentsProvider === 'monnify' &&
      (!process.env.MONNIFY_API_KEY?.trim() ||
        !process.env.MONNIFY_SECRET_KEY?.trim() ||
        !process.env.MONNIFY_CONTRACT_CODE?.trim())
    ) {
      warnings.push(
        'NG_PAYMENTS_PROVIDER=monnify but MONNIFY_API_KEY/SECRET_KEY/CONTRACT_CODE is incomplete',
      );
    }
    if (process.env.MONNIFY_API_KEY?.trim() && !process.env.MONNIFY_WEBHOOK_SECRET?.trim()) {
      warnings.push(
        'MONNIFY_WEBHOOK_SECRET is not set — Monnify webhooks will fall back to the secret key',
      );
    }
    if (
      process.env.NOAH_ENVIRONMENT === 'production' &&
      !process.env.NOAH_SIGNING_PRIVATE_KEY?.trim()
    ) {
      warnings.push(
        'NOAH_SIGNING_PRIVATE_KEY is not set — Noah API signing may fail in production',
      );
    }
    const nombaLive = process.env.NOMBA_LIVE === 'true';
    logger.log(
      nombaLive
        ? 'Nomba live mode (NOMBA_LIVE=true → https://api.nomba.com unless NOMBA_BASE_URL overrides)'
        : 'Nomba sandbox mode (NOMBA_LIVE≠true → https://sandbox.nomba.com unless NOMBA_BASE_URL overrides)',
    );
    const nombaBase = process.env.NOMBA_BASE_URL?.trim().replace(/\/$/, '');
    if (nombaLive && nombaBase?.includes('sandbox.nomba.com')) {
      warnings.push(
        'NOMBA_LIVE=true but NOMBA_BASE_URL points at sandbox — credentials/host mismatch risk',
      );
    }
    if (!nombaLive && nombaBase === 'https://api.nomba.com') {
      warnings.push(
        'NOMBA_LIVE is not true but NOMBA_BASE_URL is production — pair sandbox credentials with sandbox.nomba.com',
      );
    }
    if (process.env.RELOADLY_CLIENT_ID?.trim() && !process.env.RELOADLY_WEBHOOK_SECRET?.trim()) {
      warnings.push('RELOADLY_WEBHOOK_SECRET is not set — Reloadly webhooks will fail');
    }
  }

  const bachsKey = process.env.BACHS_SECRET_KEY?.trim();
  const polarToken = process.env.POLAR_ACCESS_TOKEN?.trim();
  if (bachsKey && !process.env.BACHS_WEBHOOK_SECRET?.trim()) {
    warnings.push('BACHS_WEBHOOK_SECRET is not set — Bachs webhooks will reject signatures');
  }
  if (polarToken && !process.env.POLAR_WEBHOOK_SECRET?.trim()) {
    warnings.push('POLAR_WEBHOOK_SECRET is not set — Polar webhooks will reject signatures');
  }
  if (
    (process.env.BILLING_NG_PROVIDER === 'bachs' ||
      process.env.BILLING_GLOBAL_PROVIDER === 'bachs') &&
    !bachsKey
  ) {
    warnings.push('BILLING_*_PROVIDER=bachs but BACHS_SECRET_KEY is empty');
  }
  if (process.env.BILLING_GLOBAL_PROVIDER === 'polar' && !polarToken) {
    warnings.push('BILLING_GLOBAL_PROVIDER=polar but POLAR_ACCESS_TOKEN is empty');
  }
  if (process.env.BILLING_NG_PROVIDER === 'monnify' && !process.env.MONNIFY_API_KEY?.trim()) {
    warnings.push('BILLING_NG_PROVIDER=monnify but MONNIFY_API_KEY is empty');
  }
  if (process.env.NG_PAYMENTS_PROVIDER === 'monnify' && !process.env.MONNIFY_API_KEY?.trim()) {
    warnings.push('NG_PAYMENTS_PROVIDER=monnify but MONNIFY_API_KEY is empty');
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
