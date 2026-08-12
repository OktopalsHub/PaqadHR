import { Logger } from '@nestjs/common';
import {
  isMonnifyLive,
  MONNIFY_PRODUCTION_BASE_URL,
  MONNIFY_SANDBOX_BASE_URL,
} from './monnify.config';
import { getNoahSigningPrivateKeyValidationWarning } from './noah.config';
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

function resolveNgPayrollProvider(): string {
  return (process.env.NG_PAYROLL_PROVIDER || process.env.NG_PAYMENTS_PROVIDER || 'nomba')
    .trim()
    .toLowerCase();
}

function resolveNgRewardsDepositProvider(): string {
  return (process.env.NG_REWARDS_DEPOSIT_PROVIDER || process.env.NG_WALLET_PAYMENTS_PROVIDER || '')
    .trim()
    .toLowerCase();
}

function resolveNgRewardsAirtimeProvider(): string {
  return (process.env.NG_REWARDS_AIRTIME_PROVIDER || 'nomba').trim().toLowerCase();
}

export function validateEnvAtBoot(): void {
  const logger = new Logger('EnvValidation');
  const isProduction = (process.env.NODE_ENV || 'development') === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];
  const nombaLive = process.env.NOMBA_LIVE === 'true';
  const monnifyLive = isMonnifyLive();
  const noahProduction = process.env.NOAH_ENVIRONMENT === 'production';
  const ngPayrollProvider = resolveNgPayrollProvider();
  const ngRewardsDepositProvider = resolveNgRewardsDepositProvider();
  const ngRewardsAirtimeProvider = resolveNgRewardsAirtimeProvider();

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

  if (nombaLive && !isProduction) {
    warnings.push(
      'NOMBA_LIVE=true while NODE_ENV is not production — real Nomba charges may run outside production app mode',
    );
  }
  if (monnifyLive && !isProduction) {
    warnings.push(
      'MONNIFY_LIVE=true while NODE_ENV is not production — real Monnify charges may run outside production app mode',
    );
  }

  if (nombaLive && !process.env.NOMBA_WEBHOOK_SIGNATURE_KEY?.trim()) {
    errors.push('NOMBA_WEBHOOK_SIGNATURE_KEY is required when NOMBA_LIVE=true');
  }

  if (monnifyLive) {
    if (!process.env.MONNIFY_WEBHOOK_SECRET?.trim()) {
      errors.push('MONNIFY_WEBHOOK_SECRET is required when MONNIFY_LIVE=true');
    }
    if (
      ngPayrollProvider === 'monnify' &&
      (!process.env.MONNIFY_API_KEY?.trim() ||
        !process.env.MONNIFY_SECRET_KEY?.trim() ||
        !process.env.MONNIFY_CONTRACT_CODE?.trim())
    ) {
      errors.push(
        'MONNIFY_LIVE=true with NG_PAYROLL_PROVIDER=monnify requires MONNIFY_API_KEY, MONNIFY_SECRET_KEY, and MONNIFY_CONTRACT_CODE',
      );
    }
  }

  if (noahProduction) {
    if (!process.env.NOAH_API_KEY?.trim()) {
      errors.push('NOAH_API_KEY is required when NOAH_ENVIRONMENT=production');
    }
    if (!process.env.NOAH_SIGNING_PRIVATE_KEY?.trim()) {
      errors.push('NOAH_SIGNING_PRIVATE_KEY is required when NOAH_ENVIRONMENT=production');
    }
  }

  logger.log(
    `NG rails: payroll=${ngPayrollProvider} deposits=${ngRewardsDepositProvider || `(follow payroll:${ngPayrollProvider})`} airtime=${ngRewardsAirtimeProvider}`,
  );

  if (!process.env.NG_PAYROLL_PROVIDER?.trim() && process.env.NG_PAYMENTS_PROVIDER?.trim()) {
    warnings.push(
      'NG_PAYMENTS_PROVIDER is deprecated — set NG_PAYROLL_PROVIDER (legacy name still works)',
    );
  }
  if (
    !process.env.NG_REWARDS_DEPOSIT_PROVIDER?.trim() &&
    process.env.NG_WALLET_PAYMENTS_PROVIDER?.trim()
  ) {
    warnings.push(
      'NG_WALLET_PAYMENTS_PROVIDER is deprecated — set NG_REWARDS_DEPOSIT_PROVIDER (legacy name still works)',
    );
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
    if (!nombaLive && !process.env.NOMBA_WEBHOOK_SIGNATURE_KEY?.trim()) {
      warnings.push(
        'NOMBA_WEBHOOK_SIGNATURE_KEY is not set — Nomba webhooks will reject signatures',
      );
    }
    if (!process.env.NOAH_API_KEY?.trim()) {
      warnings.push('NOAH_API_KEY is not set — non-NGN payments will be unavailable');
    }
    if (
      ngPayrollProvider === 'monnify' &&
      (!process.env.MONNIFY_API_KEY?.trim() ||
        !process.env.MONNIFY_SECRET_KEY?.trim() ||
        !process.env.MONNIFY_CONTRACT_CODE?.trim())
    ) {
      warnings.push(
        'NG_PAYROLL_PROVIDER=monnify but MONNIFY_API_KEY/SECRET_KEY/CONTRACT_CODE is incomplete',
      );
    }
    if (process.env.MONNIFY_API_KEY?.trim() && !process.env.MONNIFY_WEBHOOK_SECRET?.trim()) {
      if (monnifyLive) {
        errors.push('MONNIFY_WEBHOOK_SECRET is required in production when MONNIFY_LIVE=true');
      } else {
        warnings.push(
          'MONNIFY_WEBHOOK_SECRET is not set — Monnify webhooks will fall back to the secret key',
        );
      }
    }
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
  if (ngPayrollProvider === 'monnify' && !process.env.MONNIFY_API_KEY?.trim()) {
    warnings.push('NG_PAYROLL_PROVIDER=monnify but MONNIFY_API_KEY is empty');
  }
  if (ngPayrollProvider === 'bachs') {
    warnings.push(
      'NG_PAYROLL_PROVIDER must be nomba or monnify — use NG_REWARDS_DEPOSIT_PROVIDER=bachs for Bachs wallet deposits only',
    );
  }
  if (ngRewardsDepositProvider === 'bachs' && !process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN?.trim()) {
    warnings.push(
      'NG_REWARDS_DEPOSIT_PROVIDER=bachs but BACHS_WALLET_TOPUP_PRODUCT_NGN is empty — run sync:bachs-wallet-products',
    );
  }
  if (ngRewardsAirtimeProvider === 'monnify' && !process.env.MONNIFY_API_KEY?.trim()) {
    warnings.push('NG_REWARDS_AIRTIME_PROVIDER=monnify but MONNIFY_API_KEY is empty');
  }
  if (ngRewardsAirtimeProvider !== 'nomba' && ngRewardsAirtimeProvider !== 'monnify') {
    warnings.push('NG_REWARDS_AIRTIME_PROVIDER must be nomba or monnify');
  }

  const monnifyBase = process.env.MONNIFY_BASE_URL?.trim().replace(/\/$/, '');
  if (monnifyLive && monnifyBase?.includes('sandbox.monnify.com')) {
    warnings.push(
      'MONNIFY_LIVE=true but MONNIFY_BASE_URL points at sandbox — credentials/host mismatch risk',
    );
  }
  if (!monnifyLive && monnifyBase === MONNIFY_PRODUCTION_BASE_URL) {
    warnings.push(
      'MONNIFY_LIVE is not true but MONNIFY_BASE_URL is production — pair sandbox credentials with sandbox.monnify.com',
    );
  }
  if (
    (ngPayrollProvider === 'monnify' || ngRewardsAirtimeProvider === 'monnify') &&
    process.env.MONNIFY_API_KEY?.trim()
  ) {
    logger.log(
      monnifyLive
        ? `Monnify live mode (MONNIFY_LIVE=true → ${MONNIFY_PRODUCTION_BASE_URL} unless MONNIFY_BASE_URL overrides)`
        : `Monnify sandbox mode (MONNIFY_LIVE≠true → ${MONNIFY_SANDBOX_BASE_URL} unless MONNIFY_BASE_URL overrides)`,
    );
  }

  const noahSigningWarning = getNoahSigningPrivateKeyValidationWarning();
  if (noahSigningWarning) {
    warnings.push(noahSigningWarning);
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
