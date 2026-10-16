/**
 * Environment-driven Cloudflare Workers config for the web app.
 *
 * Branch defaults keep the main build on production URLs and all other
 * branches on development URLs. Explicit build variables are supported, but
 * known production/development URL mix-ups fail closed for main and dev.
 *
 * Deploys run with --keep-vars so dashboard-only observability keys survive.
 */

const DEV_DEFAULTS = {
  workerName: 'paqadhr-dev',
  compatDate: '2026-07-01',
  apiUrl: 'https://api-dev.paqadhr.com',
  appUrl: 'https://dev.paqadhr.com',
  appDomain: 'paqadhr.com',
  useSubdomainTenants: 'true',
};

const PROD_DEFAULTS = {
  ...DEV_DEFAULTS,
  workerName: 'paqadhr',
  apiUrl: 'https://prod.paqadhr.com',
  appUrl: 'https://paqadhr.com',
};

/**
 * The main branch targets production. The dev branch and feature previews
 * target the development Worker unless an explicit safe custom Worker is set.
 */
const resolveBranch = (env) =>
  (env.WORKERS_CI_BRANCH ?? env.GITHUB_REF_NAME ?? 'dev').trim() || 'dev';

const firstEnv = (env, key) => {
  const value = env[key]?.trim();
  return value ? value : undefined;
};

const toBool = (raw, fallback = false) => {
  const value = raw?.trim().toLowerCase();
  if (!value) return fallback;
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
};

const parseRoutes = (raw) => {
  const value = raw?.trim();
  if (!value) return [];
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`CF_ROUTES must be a JSON array of route objects (${error.message})`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error('CF_ROUTES must be a JSON array of route objects');
  }
  return parsed;
};

function assertBranchUrls(env, branch) {
  if (branch === 'main') {
    if (firstEnv(env, 'NEXT_PUBLIC_APP_URL') === DEV_DEFAULTS.appUrl) {
      throw new Error(
        'main build has NEXT_PUBLIC_APP_URL set to the dev URL. Set it to https://paqadhr.com in the production Workers Builds environment.',
      );
    }
    if (firstEnv(env, 'NEXT_PUBLIC_API_URL') === DEV_DEFAULTS.apiUrl) {
      throw new Error(
        'main build has NEXT_PUBLIC_API_URL set to the dev API. Set it to https://prod.paqadhr.com in the production Workers Builds environment.',
      );
    }
    if (firstEnv(env, 'CF_WORKER_NAME') === DEV_DEFAULTS.workerName) {
      throw new Error('main build cannot target the dev Worker paqadhr-dev.');
    }
  }

  if (branch === 'dev') {
    if (firstEnv(env, 'NEXT_PUBLIC_APP_URL') === PROD_DEFAULTS.appUrl) {
      throw new Error(
        'dev build has NEXT_PUBLIC_APP_URL set to the production URL. Set it to https://dev.paqadhr.com in the dev Workers Builds environment.',
      );
    }
    if (firstEnv(env, 'NEXT_PUBLIC_API_URL') === PROD_DEFAULTS.apiUrl) {
      throw new Error(
        'dev build has NEXT_PUBLIC_API_URL set to the production API. Set it to https://api-dev.paqadhr.com in the dev Workers Builds environment.',
      );
    }
    if (firstEnv(env, 'CF_WORKER_NAME') === PROD_DEFAULTS.workerName) {
      throw new Error('dev build cannot target the production Worker paqadhr.');
    }
  }
}

/**
 * Apply branch-specific defaults to the build process before Next.js inlines
 * NEXT_PUBLIC_* values. Throws when main/dev has the known opposite-environment
 * URL configured, preventing a bad bundle from being deployed silently.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {Record<string, string | undefined>}
 */
export function resolveBuildEnvironment(env = process.env) {
  const branch = resolveBranch(env);
  assertBranchUrls(env, branch);
  const defaults = branch === 'main' ? PROD_DEFAULTS : DEV_DEFAULTS;

  return {
    ...env,
    NEXT_PUBLIC_API_URL: firstEnv(env, 'NEXT_PUBLIC_API_URL') ?? defaults.apiUrl,
    NEXT_PUBLIC_APP_URL: firstEnv(env, 'NEXT_PUBLIC_APP_URL') ?? defaults.appUrl,
    NEXT_PUBLIC_APP_DOMAIN: firstEnv(env, 'NEXT_PUBLIC_APP_DOMAIN') ?? defaults.appDomain,
    NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS:
      firstEnv(env, 'NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS') ?? defaults.useSubdomainTenants,
  };
}

/**
 * Resolve the Wrangler config from a build/deploy environment map.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {Record<string, unknown>}
 */
export function resolveWorkerConfig(env = process.env) {
  const branch = resolveBranch(env);
  assertBranchUrls(env, branch);
  const defaults = branch === 'main' ? PROD_DEFAULTS : DEV_DEFAULTS;
  const configuredWorkerName = firstEnv(env, 'CF_WORKER_NAME');

  return {
    name: configuredWorkerName ?? defaults.workerName,
    main: '.open-next/worker.js',
    compatibility_date: firstEnv(env, 'CF_COMPAT_DATE') ?? defaults.compatDate,
    compatibility_flags: ['nodejs_compat', 'global_fetch_strictly_public'],
    workers_dev: toBool(env.CF_WORKERS_DEV),
    preview_urls: false,
    keep_names: false,
    assets: {
      directory: '.open-next/assets',
      binding: 'ASSETS',
    },
    observability: {
      enabled: true,
      head_sampling_rate: 1,
      redact_query_string: true,
      logs: {
        enabled: true,
        head_sampling_rate: 1,
        persist: true,
        invocation_logs: true,
      },
      traces: {
        enabled: true,
        persist: true,
        head_sampling_rate: 1,
      },
    },
    vars: {
      NEXT_PUBLIC_API_URL: firstEnv(env, 'NEXT_PUBLIC_API_URL') ?? defaults.apiUrl,
      NEXT_PUBLIC_APP_URL: firstEnv(env, 'NEXT_PUBLIC_APP_URL') ?? defaults.appUrl,
      NEXT_PUBLIC_APP_DOMAIN: firstEnv(env, 'NEXT_PUBLIC_APP_DOMAIN') ?? defaults.appDomain,
      NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS:
        firstEnv(env, 'NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS') ?? defaults.useSubdomainTenants,
    },
    routes: parseRoutes(env.CF_ROUTES),
  };
}
