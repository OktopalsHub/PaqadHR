import { normalizeHostSuffix, resolveWorkerDomainConfig } from './worker-domain.config';

const MANAGED_KEYS = [
  'CF_WORKER_DOMAIN_API_TOKEN',
  'CF_WORKER_DOMAIN_ZONE_ID',
  'CF_WORKER_DOMAIN_WORKER_NAME',
  'CF_WORKER_DOMAIN_ACCOUNT_ID',
  'CF_WORKER_DOMAIN_SUFFIX',
  'CF_WORKER_DOMAIN_ENABLED',
  'APP_DOMAIN',
  'R2_ACCOUNT_ID',
] as const;

describe('normalizeHostSuffix', () => {
  it.each([
    ['paqadhr.com', 'paqadhr.com'],
    ['https://paqadhr.com/', 'paqadhr.com'],
    [' .Dev.Paqadhr.com ', 'dev.paqadhr.com'],
    ['dev.paqadhr.com:3000', 'dev.paqadhr.com'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeHostSuffix(input)).toBe(expected);
  });
});

describe('resolveWorkerDomainConfig', () => {
  const originalEnv = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of MANAGED_KEYS) {
      originalEnv.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of MANAGED_KEYS) {
      const value = originalEnv.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    originalEnv.clear();
  });

  it('is disabled without credentials', () => {
    expect(resolveWorkerDomainConfig().enabled).toBe(false);
  });

  it('falls back to R2_ACCOUNT_ID and APP_DOMAIN', () => {
    process.env.CF_WORKER_DOMAIN_API_TOKEN = 'token';
    process.env.CF_WORKER_DOMAIN_ZONE_ID = 'zone-id';
    process.env.CF_WORKER_DOMAIN_WORKER_NAME = 'paqadhr';
    process.env.R2_ACCOUNT_ID = 'account-id';
    process.env.APP_DOMAIN = 'dev.paqadhr.com';

    const config = resolveWorkerDomainConfig();

    expect(config).toMatchObject({
      enabled: true,
      accountId: 'account-id',
      hostSuffix: 'dev.paqadhr.com',
    });
  });

  it('is disabled when the kill switch is off, without dropping the credentials', () => {
    process.env.CF_WORKER_DOMAIN_API_TOKEN = 'token';
    process.env.CF_WORKER_DOMAIN_ZONE_ID = 'zone-id';
    process.env.CF_WORKER_DOMAIN_WORKER_NAME = 'paqadhr';
    process.env.CF_WORKER_DOMAIN_ACCOUNT_ID = 'account-id';
    process.env.CF_WORKER_DOMAIN_SUFFIX = 'paqadhr.com';
    process.env.CF_WORKER_DOMAIN_ENABLED = 'false';

    const config = resolveWorkerDomainConfig();

    expect(config.enabled).toBe(false);
    expect(config.apiToken).toBe('token');
  });
});
