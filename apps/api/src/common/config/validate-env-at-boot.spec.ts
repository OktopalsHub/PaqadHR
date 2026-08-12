jest.mock('./trusted-origins', () => ({
  resolveTrustedOrigins: jest.fn(() => ['https://app.example.com']),
}));

import { validateEnvAtBoot } from './validate-env-at-boot';

const BASE_ENV: Record<string, string> = {
  DATABASE_URL: 'postgres://localhost/test',
  ACCESS_SECRET: 'access-secret-min-32-chars-long!!',
  REFRESH_SECRET: 'refresh-secret-min-32-chars-long!',
  ENCRYPTION_KEY: 'encryption-key-min-32-characters!',
  R2_ACCOUNT_ID: 'account',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET_NAME: 'bucket',
  R2_PUBLIC_ID: 'public-id',
  TRUSTED_ORIGINS: 'https://app.example.com',
  NODE_ENV: 'production',
};

function withEnv(overrides: Record<string, string | undefined>): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV) && !(key in overrides)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('validateEnvAtBoot', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('passes with minimal valid production sandbox config', () => {
    withEnv({});
    expect(() => validateEnvAtBoot()).not.toThrow();
  });

  it('fails when NOMBA_LIVE=true without webhook signature key', () => {
    withEnv({ NOMBA_LIVE: 'true' });
    expect(() => validateEnvAtBoot()).toThrow(/NOMBA_WEBHOOK_SIGNATURE_KEY/);
  });

  it('warns when NOMBA_LIVE=true outside production NODE_ENV but still boots', () => {
    withEnv({
      NOMBA_LIVE: 'true',
      NOMBA_WEBHOOK_SIGNATURE_KEY: 'sig',
      NODE_ENV: 'development',
    });
    expect(() => validateEnvAtBoot()).not.toThrow();
  });

  it('warns when MONNIFY_LIVE=true outside production NODE_ENV but still boots', () => {
    withEnv({
      MONNIFY_LIVE: 'true',
      MONNIFY_WEBHOOK_SECRET: 'wh',
      NG_PAYROLL_PROVIDER: 'monnify',
      MONNIFY_API_KEY: 'key',
      MONNIFY_SECRET_KEY: 'secret',
      MONNIFY_CONTRACT_CODE: 'contract',
      NODE_ENV: 'development',
    });
    expect(() => validateEnvAtBoot()).not.toThrow();
  });

  it('fails when MONNIFY_LIVE=true without webhook secret', () => {
    withEnv({
      MONNIFY_LIVE: 'true',
      NG_PAYROLL_PROVIDER: 'monnify',
      MONNIFY_API_KEY: 'key',
      MONNIFY_SECRET_KEY: 'secret',
      MONNIFY_CONTRACT_CODE: 'contract',
    });
    expect(() => validateEnvAtBoot()).toThrow(/MONNIFY_WEBHOOK_SECRET/);
  });

  it('fails when MONNIFY_LIVE=true with monnify NG rail but incomplete keys', () => {
    withEnv({
      MONNIFY_LIVE: 'true',
      NG_PAYROLL_PROVIDER: 'monnify',
      MONNIFY_WEBHOOK_SECRET: 'wh',
    });
    expect(() => validateEnvAtBoot()).toThrow(/MONNIFY_API_KEY/);
  });

  it('boots when only legacy NG_PAYMENTS_PROVIDER is set', () => {
    withEnv({ NG_PAYMENTS_PROVIDER: 'nomba' });
    expect(() => validateEnvAtBoot()).not.toThrow();
  });

  it('fails when NOAH_ENVIRONMENT=production without API key and signing key', () => {
    withEnv({ NOAH_ENVIRONMENT: 'production' });
    expect(() => validateEnvAtBoot()).toThrow(/NOAH_API_KEY/);
  });

  it('requires Noah signing key in production environment', () => {
    withEnv({
      NOAH_ENVIRONMENT: 'production',
      NOAH_API_KEY: 'noah-key',
    });
    expect(() => validateEnvAtBoot()).toThrow(/NOAH_SIGNING_PRIVATE_KEY/);
  });
});
