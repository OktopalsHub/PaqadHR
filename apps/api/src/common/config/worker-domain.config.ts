import { getOptional, getOptionalBoolean } from './env.util';

export const CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4';

export interface WorkerDomainConfig {
  /** True only when every credential is present and CF_WORKER_DOMAIN_ENABLED is not "false". */
  enabled: boolean;
  apiToken: string;
  accountId: string;
  zoneId: string;
  workerName: string;
  /** Tenant host suffix: slug `acme` + suffix `paqadhr.com` -> `acme.paqadhr.com`. */
  hostSuffix: string;
}

/** Accepts `paqadhr.com`, `https://paqadhr.com/`, `.paqadhr.com` — all become `paqadhr.com`. */
export function normalizeHostSuffix(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[/:].*$/, '')
    .replace(/^\.+|\.+$/g, '');
}

/**
 * Tenant subdomains are Worker custom domains, so each one is created through the
 * Cloudflare API. Unset credentials simply disable provisioning (dev relies on the
 * `*.dev.paqadhr.com` route instead), so this is optional everywhere.
 */
export function resolveWorkerDomainConfig(): WorkerDomainConfig {
  const apiToken = getOptional('CF_WORKER_DOMAIN_API_TOKEN');
  const zoneId = getOptional('CF_WORKER_DOMAIN_ZONE_ID');
  const workerName = getOptional('CF_WORKER_DOMAIN_WORKER_NAME');
  const accountId = getOptional('CF_WORKER_DOMAIN_ACCOUNT_ID') || getOptional('R2_ACCOUNT_ID');
  const hostSuffix = normalizeHostSuffix(
    getOptional('CF_WORKER_DOMAIN_SUFFIX') || getOptional('APP_DOMAIN'),
  );
  const configured = Boolean(apiToken && accountId && zoneId && workerName && hostSuffix);

  return {
    enabled: configured && getOptionalBoolean('CF_WORKER_DOMAIN_ENABLED', true),
    apiToken,
    accountId,
    zoneId,
    workerName,
    hostSuffix,
  };
}
