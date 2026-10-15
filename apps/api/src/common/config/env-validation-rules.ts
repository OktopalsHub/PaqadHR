import { isAllowedFincraBaseUrl, isFincraLive } from './fincra.config';
import { isMonnifyLive, MONNIFY_PRODUCTION_BASE_URL } from './monnify.config';
import { parseDurationToMs } from './parse-duration.util';
import { resolveTrustedOrigins } from './trusted-origins';

export const CRITICAL = [
  'DATABASE_URL',
  'ACCESS_SECRET',
  'REFRESH_SECRET',
  'ENCRYPTION_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
] as const;

export function resolveNgPayrollProvider(): string {
  return (process.env.NG_PAYROLL_PROVIDER || process.env.NG_PAYMENTS_PROVIDER || 'nomba')
    .trim()
    .toLowerCase();
}

export function resolveNgRewardsDepositProvider(): string {
  return (process.env.NG_REWARDS_DEPOSIT_PROVIDER || process.env.NG_WALLET_PAYMENTS_PROVIDER || '')
    .trim()
    .toLowerCase();
}

export function resolveIntlPayrollProvider(): string {
  return (process.env.INTL_PAYROLL_PROVIDER || 'noah').trim().toLowerCase();
}

export function resolveIntlRewardsDepositProvider(): string {
  return (process.env.INTL_REWARDS_DEPOSIT_PROVIDER || 'noah').trim().toLowerCase();
}

export function resolveNgRewardsAirtimeProvider(): string {
  return (process.env.NG_REWARDS_AIRTIME_PROVIDER || 'nomba').trim().toLowerCase();
}

export function resolveRewardsGiftCardProvider(): string {
  const value = (process.env.REWARDS_GIFT_CARD_PROVIDER || 'tremendous').trim().toLowerCase();
  return value || 'tremendous';
}

export interface EnvValidationResult {
  errors: string[];
  warnings: string[];
}

export function collectCriticalErrors(): string[] {
  const errors: string[] = [];
  for (const key of CRITICAL) {
    if (!process.env[key]?.trim()) {
      errors.push(`${key} is not set`);
    }
  }
  return errors;
}

export function collectCookieErrors(isProduction: boolean): string[] {
  const errors: string[] = [];
  const cookieCrossSite = process.env.COOKIE_CROSS_SITE?.trim().toLowerCase();
  if (cookieCrossSite !== undefined && !['true', 'false'].includes(cookieCrossSite)) {
    errors.push('COOKIE_CROSS_SITE must be true or false');
  }
  if (isProduction && cookieCrossSite !== 'true') {
    errors.push('COOKIE_CROSS_SITE=true is required in production');
  }
  if (cookieCrossSite === 'true') {
    const appDomain = process.env.APP_DOMAIN?.trim();
    if (!appDomain || appDomain === 'localhost') {
      errors.push('COOKIE_CROSS_SITE=true requires a non-localhost APP_DOMAIN');
    }
  }
  return errors;
}

export function collectConfigErrors(): string[] {
  const errors: string[] = [];
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
  return errors;
}

export function collectNombaErrors(isProduction: boolean): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nombaLive = process.env.NOMBA_LIVE === 'true';

  if (nombaLive && !isProduction) {
    warnings.push(
      'NOMBA_LIVE=true while NODE_ENV is not production — real Nomba charges may run outside production app mode',
    );
  }
  if (nombaLive && !process.env.NOMBA_WEBHOOK_SIGNATURE_KEY?.trim()) {
    errors.push('NOMBA_WEBHOOK_SIGNATURE_KEY is required when NOMBA_LIVE=true');
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
  }
  return { errors, warnings };
}

export function collectMonnifyErrors(
  isProduction: boolean,
  ngPayrollProvider: string,
  ngRewardsAirtimeProvider: string,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const monnifyLive = isMonnifyLive();

  if (monnifyLive && !isProduction) {
    warnings.push(
      'MONNIFY_LIVE=true while NODE_ENV is not production — real Monnify charges may run outside production app mode',
    );
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
  if (isProduction) {
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
  return { errors, warnings };
}

export function collectNoahErrors(): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const noahProduction = process.env.NOAH_ENVIRONMENT === 'production';

  if (noahProduction) {
    if (!process.env.NOAH_API_KEY?.trim()) {
      errors.push('NOAH_API_KEY is required when NOAH_ENVIRONMENT=production');
    }
    if (!process.env.NOAH_SIGNING_PRIVATE_KEY?.trim()) {
      errors.push('NOAH_SIGNING_PRIVATE_KEY is required when NOAH_ENVIRONMENT=production');
    }
  }
  return { errors, warnings };
}

export function collectFincraErrors(isProduction: boolean): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const fincraBaseUrl = process.env.FINCRA_BASE_URL?.trim().replace(/\/$/, '');
  if (fincraBaseUrl && !isAllowedFincraBaseUrl(fincraBaseUrl)) {
    errors.push(
      'FINCRA_BASE_URL must use HTTPS and point to api.fincra.com or sandboxapi.fincra.com',
    );
  }
  if (isFincraLive() && !process.env.FINCRA_WEBHOOK_SECRET?.trim()) {
    if (isProduction) {
      errors.push('FINCRA_LIVE=true but FINCRA_WEBHOOK_SECRET is empty');
    } else {
      warnings.push('FINCRA_LIVE=true but FINCRA_WEBHOOK_SECRET is empty');
    }
  }
  return { errors, warnings };
}

export function collectAccessExpiresInErrors(): string[] {
  const errors: string[] = [];
  const accessExpiresIn = process.env.ACCESS_EXPIRES_IN?.trim() || '15m';
  const parsedMs = parseDurationToMs(accessExpiresIn);
  if (parsedMs === null) {
    errors.push(`ACCESS_EXPIRES_IN has invalid format (got ${accessExpiresIn})`);
  } else if (parsedMs > 15 * 60 * 1000) {
    errors.push(
      `ACCESS_EXPIRES_IN must be <=15m per SECURITY.md high-security mandate (got ${accessExpiresIn})`,
    );
  }
  return errors;
}

export function collectPm2Warnings(isProduction: boolean): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pm2Instances = Number(process.env.instances ?? process.env.PM2_INSTANCES ?? 1);
  if (isProduction && pm2Instances > 1) {
    errors.push(
      `PM2 is running ${pm2Instances} workers — in-memory rate limits are per-process and security thresholds multiply. Use pm2 -i 1 (see apps/api/Dockerfile).`,
    );
  }
  if (isProduction) {
    warnings.push(
      'Using in-memory rate limits — requires single PM2 worker (-i 1) and single container; not safe for horizontal scale',
    );
  }
  return { errors, warnings };
}
