import { Logger } from '@nestjs/common';
import {
  collectAccessExpiresInErrors,
  collectConfigErrors,
  collectCookieErrors,
  collectCriticalErrors,
  collectFincraErrors,
  collectMonnifyErrors,
  collectNoahErrors,
  collectNombaErrors,
  collectPm2Warnings,
  resolveIntlPayrollProvider,
  resolveIntlRewardsDepositProvider,
  resolveNgPayrollProvider,
  resolveNgRewardsAirtimeProvider,
  resolveNgRewardsDepositProvider,
  resolveRewardsGiftCardProvider,
} from './env-validation-rules';
import {
  isMonnifyLive,
  MONNIFY_PRODUCTION_BASE_URL,
  MONNIFY_SANDBOX_BASE_URL,
} from './monnify.config';
import { getNoahSigningPrivateKeyValidationWarning } from './noah.config';

export function validateEnvAtBoot(): void {
  const logger = new Logger('EnvValidation');
  const isProduction = (process.env.NODE_ENV || 'development') === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  const ngPayrollProvider = resolveNgPayrollProvider();
  const ngRewardsDepositProvider = resolveNgRewardsDepositProvider();
  const ngRewardsAirtimeProvider = resolveNgRewardsAirtimeProvider();
  const rewardsGiftCardProvider = resolveRewardsGiftCardProvider();

  errors.push(...collectCriticalErrors());
  errors.push(...collectCookieErrors(isProduction));
  errors.push(...collectConfigErrors());

  const nomba = collectNombaErrors(isProduction);
  errors.push(...nomba.errors);
  warnings.push(...nomba.warnings);

  const monnify = collectMonnifyErrors(isProduction, ngPayrollProvider, ngRewardsAirtimeProvider);
  errors.push(...monnify.errors);
  warnings.push(...monnify.warnings);

  const noah = collectNoahErrors();
  errors.push(...noah.errors);
  warnings.push(...noah.warnings);

  const fincra = collectFincraErrors(isProduction);
  errors.push(...fincra.errors);
  warnings.push(...fincra.warnings);

  const pm2 = collectPm2Warnings(isProduction);
  errors.push(...pm2.errors);
  warnings.push(...pm2.warnings);
  errors.push(...collectAccessExpiresInErrors());

  logger.log(
    `NG rails: payroll=${ngPayrollProvider} deposits=${ngRewardsDepositProvider || `(follow payroll:${ngPayrollProvider})`} airtime=${ngRewardsAirtimeProvider}`,
  );
  logger.log(`Rewards gift-card provider: ${rewardsGiftCardProvider}`);

  if (rewardsGiftCardProvider !== 'tremendous') {
    errors.push('REWARDS_GIFT_CARD_PROVIDER must be tremendous');
  }
  if (!process.env.TREMENDOUS_API_KEY?.trim()) {
    warnings.push('TREMENDOUS_API_KEY is empty — gift catalog sync will be skipped');
  }

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

  const intlPayrollProvider = resolveIntlPayrollProvider();
  const intlRewardsDepositProvider = resolveIntlRewardsDepositProvider();
  if (intlPayrollProvider !== 'noah' && intlPayrollProvider !== 'fincra') {
    warnings.push('INTL_PAYROLL_PROVIDER must be noah or fincra');
  }
  if (intlRewardsDepositProvider !== 'noah' && intlRewardsDepositProvider !== 'fincra') {
    warnings.push('INTL_REWARDS_DEPOSIT_PROVIDER must be noah or fincra');
  }
  if (intlPayrollProvider === 'fincra' && !isFincraConfigured()) {
    warnings.push('INTL_PAYROLL_PROVIDER=fincra but FINCRA_API_KEY is not set');
  }
  if (intlRewardsDepositProvider === 'fincra' && !isFincraCheckoutConfigured()) {
    warnings.push(
      'INTL_REWARDS_DEPOSIT_PROVIDER=fincra but FINCRA_API_KEY and FINCRA_PUBLIC_KEY must both be set',
    );
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
  if (ngPayrollProvider === 'fincra' && !isFincraConfigured()) {
    warnings.push('NG_PAYROLL_PROVIDER=fincra but FINCRA_API_KEY is not set');
  }
  if (ngPayrollProvider === 'bachs') {
    warnings.push(
      'NG_PAYROLL_PROVIDER must be nomba, monnify, or fincra — use NG_REWARDS_DEPOSIT_PROVIDER=bachs for Bachs wallet deposits only',
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

  if (isProduction) {
    logger.log(
      isMonnifyLive()
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

function isFincraConfigured(): boolean {
  return Boolean(process.env.FINCRA_API_KEY?.trim());
}

function isFincraCheckoutConfigured(): boolean {
  return Boolean(process.env.FINCRA_API_KEY?.trim() && process.env.FINCRA_PUBLIC_KEY?.trim());
}
