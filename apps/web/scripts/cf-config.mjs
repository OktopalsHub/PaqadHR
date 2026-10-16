/**
 * Environment-driven Cloudflare Workers config for the web app.
 *
 * Every environment-specific value (worker name, vars, routes,
 * compatibility date) is read from the environment — `.env` for local runs,
 * or the per-build environment variables configured on Cloudflare Workers
 * Builds — so the dev, main and production Workers are all deployed from
 * this repo with zero code changes. Values left unset fall back to the dev
 * defaults below, so local `pnpm cf:preview` keeps working unchanged.
 *
 * Deploys run with `--keep-vars`, so any var set directly on the Worker in
 * the Cloudflare dashboard wins over these values (that is how the PostHog
 * and Sentry keys survive every deploy).
 *
 * Env vars:
 *   CF_WORKER_NAME                Worker to deploy (overrides the branch default)
 *   CF_COMPAT_DATE                compatibility_date (default: 2026-07-01)
 *   CF_WORKERS_DEV                "true" to also publish on workers.dev
 *   CF_ROUTES                     JSON array of route/custom-domain objects
 *   NEXT_PUBLIC_API_URL           API base URL used by the Worker
 *   NEXT_PUBLIC_APP_URL           App base URL used by the Worker
 *   NEXT_PUBLIC_APP_DOMAIN        Apex domain used for tenant subdomains
 *   NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS  "true"/"false"
 */

const DEFAULTS = {
  workerName: 'paqadhr-dev',
  compatDate: '2026-07-01',
  apiUrl: 'https://api-dev.paqadhr.com',
  appUrl: 'https://dev.paqadhr.com',
  appDomain: 'paqadhr.com',
  useSubdomainTenants: 'true',
};

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

/**
 * Resolve the wrangler config from an environment map.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {Record<string, unknown>} wrangler configuration object
 */
export function resolveWorkerConfig(env = process.env) {
  const branch = (env.WORKERS_CI_BRANCH ?? env.GITHUB_REF_NAME ?? 'dev').trim() || 'dev';
  const branchWorkerName = branch === 'main' ? 'paqadhr' : undefined;

  return {
    name: firstEnv(env, 'CF_WORKER_NAME') ?? branchWorkerName ?? DEFAULTS.workerName,
    main: '.open-next/worker.js',
    compatibility_date: firstEnv(env, 'CF_COMPAT_DATE') ?? DEFAULTS.compatDate,
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
      NEXT_PUBLIC_API_URL: firstEnv(env, 'NEXT_PUBLIC_API_URL') ?? DEFAULTS.apiUrl,
      NEXT_PUBLIC_APP_URL: firstEnv(env, 'NEXT_PUBLIC_APP_URL') ?? DEFAULTS.appUrl,
      NEXT_PUBLIC_APP_DOMAIN: firstEnv(env, 'NEXT_PUBLIC_APP_DOMAIN') ?? DEFAULTS.appDomain,
      NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS:
        firstEnv(env, 'NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS') ?? DEFAULTS.useSubdomainTenants,
    },
    // No routes by default: custom domains are per-deployment and require
    // zone access, so they are set through CF_ROUTES instead of hardcoded.
    routes: parseRoutes(env.CF_ROUTES),
  };
}
